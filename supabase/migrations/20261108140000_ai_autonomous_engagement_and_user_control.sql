-- Migration: 20261108140000_ai_autonomous_engagement_and_user_control.sql
-- Description: v2.6.0 Autonomous opportunity discovery, per-profile preferences, and opportunity categories

-- 1. Extend ai_proactive_jobs with opportunity categorization and discovery fields
ALTER TABLE public.ai_proactive_jobs
    ADD COLUMN IF NOT EXISTS opportunity_category TEXT DEFAULT 'conversation_continuation',
    ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2) DEFAULT 0.80,
    ADD COLUMN IF NOT EXISTS discovery_metadata JSONB DEFAULT '{}'::jsonb;

-- Ensure valid opportunity categories
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ai_proactive_jobs_opportunity_category_check'
    ) THEN
        ALTER TABLE public.ai_proactive_jobs
            ADD CONSTRAINT ai_proactive_jobs_opportunity_category_check
            CHECK (opportunity_category IN (
                'unfinished_topic',
                'upcoming_event',
                'event_followup',
                'personal_goal',
                'shared_interest',
                'emotional_support',
                'conversation_continuation'
            ));
    END IF;
END $$;

-- 2. Extend ai_user_engagement_preferences with timezone and per-profile rules
ALTER TABLE public.ai_user_engagement_preferences
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS disabled_profile_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- 3. Create table for granular per-AI-profile preferences (optional per-profile overrides)
CREATE TABLE IF NOT EXISTS public.ai_user_profile_engagement_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ai_profile_id UUID NOT NULL,
    proactive_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_ai_user_profile_pref UNIQUE (user_id, ai_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_user_profile_pref_lookup
    ON public.ai_user_profile_engagement_preferences (user_id, ai_profile_id);

ALTER TABLE public.ai_user_profile_engagement_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_user_profile_engagement_preferences"
    ON public.ai_user_profile_engagement_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view own per-profile engagement preferences"
    ON public.ai_user_profile_engagement_preferences
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own per-profile engagement preferences"
    ON public.ai_user_profile_engagement_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own per-profile engagement preferences"
    ON public.ai_user_profile_engagement_preferences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. Prevent duplicate pending jobs for the same user and chat
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_proactive_jobs_pending_unique
    ON public.ai_proactive_jobs (user_id, chat_id)
    WHERE status = 'pending';

-- 5. Operational metrics aggregation helper view
CREATE OR REPLACE VIEW public.ai_engagement_metrics AS
SELECT
    status,
    opportunity_category,
    COUNT(*) as total_count,
    COUNT(CASE WHEN skip_reason IS NOT NULL THEN 1 END) as skipped_count,
    COUNT(CASE WHEN dispatched_message_id IS NOT NULL THEN 1 END) as dispatched_count,
    MAX(created_at) as last_activity_at
FROM public.ai_proactive_jobs
GROUP BY status, opportunity_category;
