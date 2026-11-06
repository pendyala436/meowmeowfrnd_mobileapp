-- ============================================================================
-- Migration: 20261020233000_seed_initial_ai_persona.sql
-- Description: Creates an initial female AI persona profile and registers it in ai_personas.
-- ============================================================================

DO $$
DECLARE
    v_ai_user_id UUID := 'a1000000-0000-0000-0000-000000000001'::uuid;
BEGIN
    -- 0. Ensure user exists in auth.users (public.profiles has FK user_id REFERENCES auth.users(id))
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_ai_user_id) THEN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            created_at,
            updated_at,
            raw_app_meta_data,
            raw_user_meta_data,
            is_super_admin,
            role,
            aud
        ) VALUES (
            v_ai_user_id,
            '00000000-0000-0000-0000-000000000000',
            'aarya.ai@meow-meow.com',
            '',
            now(),
            now(),
            now(),
            '{"provider":"email","providers":["email"]}',
            '{"full_name":"Aarya","gender":"female","is_ai":true}',
            false,
            'authenticated',
            'authenticated'
        );
    END IF;

    -- 1. Ensure user status exists and is online
    INSERT INTO public.user_status (user_id, is_online, last_seen, status, status_text)
    VALUES (
        v_ai_user_id,
        true,
        now(),
        'online',
        'Online & Ready to chat'
    )
    ON CONFLICT (user_id) DO UPDATE
    SET is_online = true, last_seen = now();

    -- 2. Ensure profile exists in public.profiles
    INSERT INTO public.profiles (
        user_id,
        full_name,
        gender,
        age,
        bio,
        country,
        state,
        city,
        primary_language,
        preferred_language,
        photo_url,
        is_verified,
        account_status,
        approval_status,
        ai_approved
    )
    VALUES (
        v_ai_user_id,
        'Aarya',
        'female',
        22,
        'Namaste! I am Aarya, a friendly companion. I love discussing Indian music, cinema, science, and life stories.',
        'India',
        'Maharashtra',
        'Mumbai',
        'Hindi',
        'Hindi',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
        true,
        'active',
        'approved',
        true
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        full_name = EXCLUDED.full_name,
        bio = EXCLUDED.bio,
        account_status = 'active',
        approval_status = 'approved';

    -- 3. Register languages in user_languages
    INSERT INTO public.user_languages (user_id, language_code, language_name)
    VALUES
        (v_ai_user_id, 'hi', 'Hindi'),
        (v_ai_user_id, 'en', 'English')
    ON CONFLICT (user_id, language_code) DO NOTHING;

    -- 4. Register in ai_personas
    INSERT INTO public.ai_personas (
        user_id,
        persona_code,
        display_name,
        system_prompt,
        model_name,
        temperature,
        max_tokens,
        is_active
    )
    VALUES (
        v_ai_user_id,
        'aarya_ai',
        'Aarya',
        'You are Aarya, a 22-year-old friendly college student from Mumbai. You are an AI companion on Meow Meow. You speak fluent Hindi, English, and Hinglish. You are empathetic, upbeat, warm, and love music, poetry, and engaging conversations. Keep your replies concise and conversational.',
        'qwen3:4b',
        0.7,
        180,
        true
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        display_name = EXCLUDED.display_name,
        system_prompt = EXCLUDED.system_prompt,
        model_name = EXCLUDED.model_name,
        is_active = true;

END $$;
