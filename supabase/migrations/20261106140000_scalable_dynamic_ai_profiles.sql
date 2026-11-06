-- ============================================================================
-- Migration: 20261106140000_scalable_dynamic_ai_profiles.sql
-- Description: Enables dynamic AI-managed female profiles system:
--   1. Adds is_ai_managed and ai_persona_status to female_profiles
--   2. Modifies ai_message_jobs to reference user_id directly instead of ai_personas(id)
--   3. Updates public_female_profiles view to safely expose is_ai_managed
--   4. Grants necessary permissions and creates high-performance indexes
-- ============================================================================

-- 1. Add is_ai_managed flag to public.female_profiles
ALTER TABLE public.female_profiles
ADD COLUMN IF NOT EXISTS is_ai_managed BOOLEAN NOT NULL DEFAULT false;

-- Create partial index for rapid lookup of active AI profiles
CREATE INDEX IF NOT EXISTS idx_female_profiles_ai_active 
ON public.female_profiles (user_id) 
WHERE is_ai_managed = true AND approval_status = 'approved' AND account_status = 'active';

-- Also ensure public.profiles has is_ai_managed if queries check profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_ai_managed BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_ai_managed
ON public.profiles (user_id)
WHERE is_ai_managed = true;

-- 2. Modify public.ai_message_jobs to decouple from ai_personas table
-- Make persona_id nullable or alter FK so any recipient profile user_id can be tracked
DO $$
BEGIN
    -- Check if ai_message_jobs exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'ai_message_jobs'
    ) THEN
        -- Add recipient_id column if not exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'ai_message_jobs' AND column_name = 'recipient_id'
        ) THEN
            ALTER TABLE public.ai_message_jobs ADD COLUMN recipient_id UUID;
        END IF;

        -- Make persona_id nullable if it was NOT NULL
        ALTER TABLE public.ai_message_jobs ALTER COLUMN persona_id DROP NOT NULL;

        -- Add index on recipient_id
        CREATE INDEX IF NOT EXISTS idx_ai_message_jobs_recipient_id ON public.ai_message_jobs(recipient_id);
    END IF;
END $$;

-- 3. Synchronize existing ai_personas to have is_ai_managed = true in female_profiles & profiles
UPDATE public.female_profiles
SET is_ai_managed = true
WHERE user_id IN (SELECT user_id FROM public.ai_personas WHERE is_active = true);

UPDATE public.profiles
SET is_ai_managed = true
WHERE user_id IN (SELECT user_id FROM public.ai_personas WHERE is_active = true);

-- 4. Re-create public_female_profiles view to include is_ai_managed safely
DROP VIEW IF EXISTS public.public_female_profiles CASCADE;

CREATE VIEW public.public_female_profiles
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  full_name,
  photo_url,
  age,
  country,
  state,
  primary_language,
  preferred_language,
  bio,
  interests,
  is_earning_eligible,
  is_indian,
  is_premium,
  is_verified,
  has_golden_badge,
  earning_badge_type,
  approval_status,
  account_status,
  last_active_at,
  created_at,
  is_ai_managed
FROM public.female_profiles
WHERE approval_status = 'approved'
  AND account_status = 'active';

-- Grant SELECT on the view and new column
GRANT SELECT ON public.public_female_profiles TO authenticated, anon;

GRANT SELECT (is_ai_managed) ON public.female_profiles TO authenticated;
GRANT SELECT (is_ai_managed) ON public.profiles TO authenticated, anon;
