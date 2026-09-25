-- Allow unlimited language leaders (no demote / no unique-per-language)
DROP INDEX IF EXISTS public.profiles_one_leader_per_language_idx;

CREATE OR REPLACE FUNCTION public.admin_toggle_language_leader(
  p_user_id uuid,
  p_make_leader boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_profile RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_role(v_caller, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT user_id, gender, primary_language, approval_status
    INTO v_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF p_make_leader THEN
    IF lower(coalesce(v_profile.gender,'')) <> 'female' THEN
      RAISE EXCEPTION 'Leader badge can only be assigned to women';
    END IF;
    IF coalesce(v_profile.approval_status,'') <> 'approved' THEN
      RAISE EXCEPTION 'User must be an approved woman';
    END IF;
    IF v_profile.primary_language IS NULL OR v_profile.primary_language = '' THEN
      RAISE EXCEPTION 'User has no primary language set';
    END IF;

    UPDATE public.profiles
    SET is_language_leader = true, updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.profiles
    SET is_language_leader = false, updated_at = now()
    WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id, 'is_leader', p_make_leader);
END;
$$;

-- Admin-initiated 1:1 calls bypass language matching (admin has no call language)
CREATE OR REPLACE FUNCTION public.enforce_indian_call_languages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_man_lang text;
  v_woman_lang text;
  v_cap jsonb;
BEGIN
  IF NEW.status IS NULL OR NEW.status NOT IN ('pending', 'ringing', 'connecting', 'active') THEN
    RETURN NEW;
  END IF;

  -- Free admin → user calls skip language / capacity gates
  IF public.has_role(NEW.man_user_id, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  v_man_lang := public.profile_call_language(NEW.man_user_id);
  v_woman_lang := public.profile_call_language(NEW.woman_user_id);

  IF NOT public.is_indian_call_language(v_man_lang)
     OR NOT public.is_indian_call_language(v_woman_lang)
     OR public.normalize_call_language(v_man_lang) <> public.normalize_call_language(v_woman_lang) THEN
    RAISE EXCEPTION 'Audio and video calls are only available for Hindi, Bengali, Marathi, Telugu, and Tamil, and both users must share that language';
  END IF;

  v_cap := public.assert_language_call_capacity(v_man_lang, 2);
  IF COALESCE((v_cap->>'allowed')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_cap->>'error', 'Call language is at capacity');
  END IF;

  RETURN NEW;
END;
$$;
