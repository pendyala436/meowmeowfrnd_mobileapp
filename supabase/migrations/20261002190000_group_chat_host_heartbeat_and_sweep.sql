-- Group chat: close abandoned live rooms when the host disappears (tab close / crash).
-- Mirrors sweep_stale_group_hosts for private group calls.

ALTER TABLE public.group_chat_sessions
  ADD COLUMN IF NOT EXISTS host_last_seen_at timestamptz;

UPDATE public.group_chat_sessions
SET host_last_seen_at = COALESCE(host_last_seen_at, started_at, now())
WHERE ended_at IS NULL AND host_last_seen_at IS NULL;

COMMENT ON COLUMN public.group_chat_sessions.host_last_seen_at IS
  'Host heartbeat timestamp; stale sessions are swept offline.';

-- Touch go_live so new sessions start with a fresh heartbeat.
CREATE OR REPLACE FUNCTION public.group_chat_go_live(p_room_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_gender text;
  v_room RECORD;
  v_session_id uuid;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthenticated'); END IF;
  SELECT gender INTO v_gender FROM public.profiles WHERE user_id = v_user LIMIT 1;
  IF v_gender IS DISTINCT FROM 'female' THEN
    RETURN jsonb_build_object('success',false,'error','only women can host');
  END IF;
  SELECT * INTO v_room FROM public.group_chat_rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','room not found'); END IF;
  IF v_room.status = 'live' THEN
    RETURN jsonb_build_object('success',false,'error','room already live');
  END IF;

  UPDATE public.group_chat_sessions SET ended_at = now() WHERE host_id = v_user AND ended_at IS NULL;
  UPDATE public.group_chat_rooms SET status='offline', current_host_id=NULL, current_session_id=NULL, current_participant_count=0
    WHERE current_host_id = v_user;

  INSERT INTO public.group_chat_sessions (room_id, host_id, host_last_seen_at)
    VALUES (p_room_id, v_user, now())
    RETURNING id INTO v_session_id;
  INSERT INTO public.group_chat_participants (session_id, user_id)
    VALUES (v_session_id, v_user);

  UPDATE public.group_chat_rooms
    SET status='live', current_host_id=v_user, current_session_id=v_session_id, current_participant_count=0, updated_at=now()
    WHERE id = p_room_id;
  RETURN jsonb_build_object('success',true,'session_id',v_session_id);
END $$;

CREATE OR REPLACE FUNCTION public.group_chat_host_heartbeat(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_updated integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  UPDATE public.group_chat_sessions
  SET host_last_seen_at = now()
  WHERE id = p_session_id
    AND host_id = v_user
    AND ended_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'no live host session');
  END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.group_chat_host_heartbeat(uuid) TO authenticated;

-- Shared end body used by host end + sweeper + participant report.
CREATE OR REPLACE FUNCTION public.group_chat_force_end_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_man uuid;
BEGIN
  SELECT * INTO v_session FROM public.group_chat_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not found'); END IF;
  IF v_session.ended_at IS NOT NULL THEN RETURN jsonb_build_object('success',true,'already_ended',true); END IF;

  BEGIN
    FOR v_man IN
      SELECT p.user_id
        FROM public.group_chat_participants gcp
        JOIN public.profiles p ON p.user_id = gcp.user_id
       WHERE gcp.session_id = p_session_id
         AND gcp.left_at IS NULL
         AND p.gender = 'male'
    LOOP
      BEGIN
        PERFORM public.bill_group_chat_leftover(p_session_id, v_man);
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  UPDATE public.group_chat_sessions
    SET ended_at = now(), host_last_seen_at = COALESCE(host_last_seen_at, now())
  WHERE id = p_session_id;
  UPDATE public.group_chat_participants SET left_at = now() WHERE session_id = p_session_id AND left_at IS NULL;
  UPDATE public.group_chat_rooms
    SET status='offline', current_host_id=NULL, current_session_id=NULL, current_participant_count=0, updated_at=now()
    WHERE id = v_session.room_id;
  RETURN jsonb_build_object('success',true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.group_chat_force_end_session(uuid) TO service_role;

-- Keep host end_live as the public path; reuse force end.
CREATE OR REPLACE FUNCTION public.group_chat_end_live(p_session_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session RECORD;
BEGIN
  SELECT * INTO v_session FROM public.group_chat_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not found'); END IF;
  IF v_user IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthenticated'); END IF;
  IF v_session.host_id IS DISTINCT FROM v_user AND NOT public.has_role(v_user,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','not host');
  END IF;
  RETURN public.group_chat_force_end_session(p_session_id);
END $$;

-- Any active participant can close a session if the host is gone / stale.
CREATE OR REPLACE FUNCTION public.group_chat_close_if_host_gone(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_session RECORD;
  v_host_active boolean;
  v_stale boolean;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success',false,'error','unauthenticated'); END IF;

  SELECT * INTO v_session FROM public.group_chat_sessions WHERE id = p_session_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','not found'); END IF;
  IF v_session.ended_at IS NOT NULL THEN RETURN jsonb_build_object('success',true,'already_ended',true); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.group_chat_participants
    WHERE session_id = p_session_id AND user_id = v_user AND left_at IS NULL
  ) AND v_session.host_id IS DISTINCT FROM v_user AND NOT public.has_role(v_user,'admin') THEN
    RETURN jsonb_build_object('success',false,'error','not a participant');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.group_chat_participants
    WHERE session_id = p_session_id AND user_id = v_session.host_id AND left_at IS NULL
  ) INTO v_host_active;

  v_stale := COALESCE(v_session.host_last_seen_at, v_session.started_at) < now() - interval '45 seconds';

  IF v_host_active AND NOT v_stale THEN
    RETURN jsonb_build_object('success',false,'error','host still present');
  END IF;

  RETURN public.group_chat_force_end_session(p_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.group_chat_close_if_host_gone(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.group_chat_sweep_stale_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_id IN
    SELECT s.id
    FROM public.group_chat_sessions s
    WHERE s.ended_at IS NULL
      AND (
        COALESCE(s.host_last_seen_at, s.started_at) < now() - interval '90 seconds'
        OR NOT EXISTS (
          SELECT 1 FROM public.group_chat_participants p
          WHERE p.session_id = s.id AND p.user_id = s.host_id AND p.left_at IS NULL
        )
      )
  LOOP
    PERFORM public.group_chat_force_end_session(v_id);
    v_count := v_count + 1;
  END LOOP;

  -- Rooms marked live with no open session
  UPDATE public.group_chat_rooms r
  SET status='offline', current_host_id=NULL, current_session_id=NULL, current_participant_count=0, updated_at=now()
  WHERE r.status = 'live'
    AND (
      r.current_session_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.group_chat_sessions s
        WHERE s.id = r.current_session_id AND s.ended_at IS NULL
      )
    );

  RETURN jsonb_build_object('success', true, 'swept', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.group_chat_sweep_stale_sessions() TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('sweep-stale-group-chat-sessions')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sweep-stale-group-chat-sessions');

    PERFORM cron.schedule(
      'sweep-stale-group-chat-sessions',
      '* * * * *',
      $cron$ SELECT public.group_chat_sweep_stale_sessions(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'group chat sweep cron not scheduled: %', SQLERRM;
END $$;
