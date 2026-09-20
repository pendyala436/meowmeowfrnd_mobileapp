-- Friend request: notify the recipient so dashboards / panels can surface them
CREATE OR REPLACE FUNCTION public.send_friend_request(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_sender_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF v_user_id = p_target_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send friend request to yourself');
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocked_by = v_user_id AND blocked_user_id = p_target_user_id)
       OR (blocked_by = p_target_user_id AND blocked_user_id = v_user_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot send friend request - user is blocked');
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_friends
    WHERE status = 'accepted'
      AND ((user_id = v_user_id AND friend_id = p_target_user_id)
        OR (user_id = p_target_user_id AND friend_id = v_user_id))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already friends with this user');
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_friends
    WHERE status = 'pending'
      AND ((user_id = v_user_id AND friend_id = p_target_user_id)
        OR (user_id = p_target_user_id AND friend_id = v_user_id))
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'A friend request already exists between you two');
  END IF;

  INSERT INTO user_friends (user_id, friend_id, status, created_by)
  VALUES (v_user_id, p_target_user_id, 'pending', v_user_id)
  RETURNING id INTO v_request_id;

  SELECT COALESCE(full_name, 'Someone') INTO v_sender_name
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  INSERT INTO notifications (user_id, title, message, type, action_url)
  VALUES (
    p_target_user_id,
    'Friend Request',
    COALESCE(v_sender_name, 'Someone') || ' sent you a friend request.',
    'friend_request',
    '/friends?request=' || v_request_id::text
  );

  RETURN jsonb_build_object('success', true, 'message', 'Friend request sent', 'request_id', v_request_id);
END;
$$;
