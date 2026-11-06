-- ============================================================================
-- Migration: 20261020232200_ai_persona_chat_system.sql
-- Description: AI Persona chat system schema, persona registration, and queue.
-- ============================================================================

-- 1. Create table for trusted server-side AI personas
CREATE TABLE IF NOT EXISTS public.ai_personas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    persona_code TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'qwen3:4b',
    temperature NUMERIC NOT NULL DEFAULT 0.7,
    max_tokens INTEGER NOT NULL DEFAULT 200,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_personas_user_id ON public.ai_personas(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_personas_active ON public.ai_personas(is_active);

-- Enable RLS on ai_personas
ALTER TABLE public.ai_personas ENABLE ROW LEVEL SECURITY;

-- Public/authenticated can view active personas (needed to render AI badge / disclaimer)
DROP POLICY IF EXISTS "Anyone can view active AI personas"
    ON public.ai_personas;

CREATE POLICY "Anyone can view active AI personas"
    ON public.ai_personas FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Only service role / admin can modify personas
DROP POLICY IF EXISTS "Admins can manage AI personas"
    ON public.ai_personas;

CREATE POLICY "Admins can manage AI personas"
    ON public.ai_personas FOR ALL
    TO authenticated
    USING (public.has_role(public.uid(), 'admin'::public.app_role))
    WITH CHECK (public.has_role(public.uid(), 'admin'::public.app_role));

-- 2. Create message processing queue table to prevent duplicate AI responses
CREATE TABLE IF NOT EXISTS public.ai_message_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL UNIQUE REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    persona_id UUID NOT NULL REFERENCES public.ai_personas(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_message_jobs_status ON public.ai_message_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_message_jobs_message_id ON public.ai_message_jobs(message_id);

ALTER TABLE public.ai_message_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on ai_message_jobs"
    ON public.ai_message_jobs;

CREATE POLICY "Service role full access on ai_message_jobs"
    ON public.ai_message_jobs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Do not expose profiles through a broad public view.
-- The application reads active persona metadata from ai_personas.
GRANT SELECT ON public.ai_personas TO authenticated, anon;
