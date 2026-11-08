-- ==============================================================================
-- Migration: 20261108120000_ai_user_long_term_memory.sql
-- Description: Creates persistent, privacy-preserving long-term conversational
--              memory table partitioned by user_id and ai_profile_id.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.ai_user_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    ai_profile_id UUID NOT NULL,
    memory_content TEXT NOT NULL,
    memory_category TEXT NOT NULL CHECK (memory_category IN ('preference', 'interest', 'personal', 'continuity', 'fact', 'other')),
    importance INTEGER NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
    confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.90 CHECK (confidence BETWEEN 0.00 AND 1.00),
    source_message_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_ai_user_memory UNIQUE (user_id, ai_profile_id, memory_category, memory_content)
);

-- Efficient lookup index for a specific user and AI companion relationship
CREATE INDEX IF NOT EXISTS idx_ai_user_memories_lookup
    ON public.ai_user_memories (user_id, ai_profile_id, is_active, importance DESC);

-- Index for source message reference tracking
CREATE INDEX IF NOT EXISTS idx_ai_user_memories_source_msg
    ON public.ai_user_memories (source_message_id)
    WHERE source_message_id IS NOT NULL;

-- Enable Row Level Security
ALTER TABLE public.ai_user_memories ENABLE ROW LEVEL SECURITY;

-- Service role has full access for the background AI worker daemon
CREATE POLICY "Service role full access on ai_user_memories"
    ON public.ai_user_memories
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- End-users can only view or manage their own active memories for privacy
CREATE POLICY "Users can view own memories"
    ON public.ai_user_memories
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update or soft-delete own memories"
    ON public.ai_user_memories
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
