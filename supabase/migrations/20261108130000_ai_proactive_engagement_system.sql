-- ==============================================================================
-- Migration: 20261108130000_ai_proactive_engagement_system.sql
-- Description: Creates user engagement preferences and proactive follow-up job queue
--              tables for AI companions with strict consent, rate limiting, and auditing.
-- ==============================================================================

-- 1. User engagement preferences table
CREATE TABLE IF NOT EXISTS public.ai_user_engagement_preferences (
    user_id UUID PRIMARY KEY,
    proactive_enabled BOOLEAN NOT NULL DEFAULT false, -- Safe opt-in default
    quiet_hours_start INTEGER NOT NULL DEFAULT 22, -- 22:00 (10 PM)
    quiet_hours_end INTEGER NOT NULL DEFAULT 8,    -- 08:00 (8 AM)
    max_proactive_per_day INTEGER NOT NULL DEFAULT 1 CHECK (max_proactive_per_day BETWEEN 1 AND 5),
    min_hours_between_messages INTEGER NOT NULL DEFAULT 24 CHECK (min_hours_between_messages >= 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- RLS for user engagement preferences
ALTER TABLE public.ai_user_engagement_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_user_engagement_preferences"
    ON public.ai_user_engagement_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users can view own engagement preferences"
    ON public.ai_user_engagement_preferences
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own engagement preferences"
    ON public.ai_user_engagement_preferences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own engagement preferences"
    ON public.ai_user_engagement_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- 2. Proactive message jobs queue & audit log
CREATE TABLE IF NOT EXISTS public.ai_proactive_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT NOT NULL,
    user_id UUID NOT NULL,
    ai_profile_id UUID NOT NULL,
    topic_summary TEXT NOT NULL,
    memory_id UUID REFERENCES public.ai_user_memories(id) ON DELETE SET NULL,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'skipped', 'failed')),
    skip_reason TEXT,
    generated_message TEXT,
    dispatched_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for efficient scheduler polling and duplicate checks
CREATE INDEX IF NOT EXISTS idx_ai_proactive_jobs_schedule
    ON public.ai_proactive_jobs (status, scheduled_for)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_proactive_jobs_pair_history
    ON public.ai_proactive_jobs (user_id, ai_profile_id, status, created_at DESC);

-- RLS for proactive jobs
ALTER TABLE public.ai_proactive_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_proactive_jobs"
    ON public.ai_proactive_jobs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
