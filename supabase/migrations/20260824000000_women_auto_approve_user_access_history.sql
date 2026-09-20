-- Women auto-approved by default; history table for admin enable/disable actions

-- Backfill: approve all existing women still pending
UPDATE public.profiles
SET approval_status = 'approved',
    updated_at = now()
WHERE lower(coalesce(gender, '')) IN ('female', 'woman', 'women')
  AND coalesce(approval_status, 'pending') = 'pending';

UPDATE public.female_profiles
SET approval_status = 'approved',
    updated_at = now()
WHERE coalesce(approval_status, 'pending') = 'pending';

-- Default new female_profiles rows to approved (registration also sets this explicitly)
ALTER TABLE public.female_profiles
  ALTER COLUMN approval_status SET DEFAULT 'approved';

-- History of admin enable/disable actions for men and women
CREATE TABLE IF NOT EXISTS public.user_access_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID,
  user_name TEXT,
  user_email TEXT,
  gender TEXT,
  action TEXT NOT NULL CHECK (action IN ('enabled', 'disabled')),
  previous_status TEXT,
  new_status TEXT NOT NULL,
  admin_id UUID NOT NULL,
  admin_email TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_access_history_created_at
  ON public.user_access_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_access_history_user_id
  ON public.user_access_history (user_id);
CREATE INDEX IF NOT EXISTS idx_user_access_history_gender
  ON public.user_access_history (gender);

ALTER TABLE public.user_access_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view user access history" ON public.user_access_history;
CREATE POLICY "Admins can view user access history"
  ON public.user_access_history
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert user access history" ON public.user_access_history;
CREATE POLICY "Admins can insert user access history"
  ON public.user_access_history
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
