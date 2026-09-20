-- TL Communication (persistent, free, admin + TL women)
-- Women Score leaderboard (credits since last payout / month start)
-- Admin messenger directory (online + last-offline, recharge split)

CREATE OR REPLACE FUNCTION public.is_tl_or_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.has_role(_uid, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.user_service_roles
         WHERE user_id = _uid AND role = 'tl_role'
      );
$$;

CREATE TABLE IF NOT EXISTS public.tl_communication_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  message text,
  file_url text,
  file_type text,
  file_name text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tl_communication_messages_created
  ON public.tl_communication_messages (created_at ASC);

ALTER TABLE public.tl_communication_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TL comm select" ON public.tl_communication_messages;
CREATE POLICY "TL comm select"
  ON public.tl_communication_messages FOR SELECT
  TO authenticated
  USING (public.is_tl_or_admin(auth.uid()));

DROP POLICY IF EXISTS "TL comm insert" ON public.tl_communication_messages;
CREATE POLICY "TL comm insert"
  ON public.tl_communication_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_tl_or_admin(auth.uid())
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.tl_communication_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT, INSERT ON public.tl_communication_messages TO authenticated;
GRANT ALL ON public.tl_communication_messages TO service_role;

-- Women scoreboard: credits after last payout snapshot, else start of current IST month
CREATE OR REPLACE FUNCTION public.get_women_scoreboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_month_start timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.user_id = v_uid AND lower(COALESCE(p.gender, '')) = 'female'
    )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_month_start := date_trunc('month', timezone('Asia/Kolkata', now()))
                   AT TIME ZONE 'Asia/Kolkata';

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x)::jsonb ORDER BY x.total DESC, x.full_name ASC)
    FROM (
      SELECT
        p.user_id,
        COALESCE(p.full_name, 'User') AS full_name,
        p.photo_url,
        COALESCE(agg.total, 0)::numeric AS total,
        COALESCE(agg.days, '[]'::jsonb) AS days
      FROM public.profiles p
      LEFT JOIN LATERAL (
        SELECT
          GREATEST(
            v_month_start,
            COALESCE((
              SELECT max(s.created_at)
                FROM public.women_payout_snapshots s
               WHERE s.user_id = p.user_id
            ), v_month_start)
          ) AS since
      ) b ON true
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(sum(d.amount), 0) AS total,
          COALESCE(
            jsonb_agg(
              jsonb_build_object('date', d.day, 'amount', d.amount)
              ORDER BY d.day
            ) FILTER (WHERE d.day IS NOT NULL),
            '[]'::jsonb
          ) AS days
        FROM (
          SELECT
            timezone('Asia/Kolkata', wt.created_at)::date AS day,
            sum(wt.amount) AS amount
          FROM public.wallet_transactions wt
          WHERE wt.user_id = p.user_id
            AND wt.type = 'credit'
            AND COALESCE(wt.status, 'completed') IN ('completed', 'success')
            AND COALESCE(wt.transaction_type, '') NOT IN ('recharge', 'refund', 'opening_balance')
            AND wt.created_at >= b.since
          GROUP BY 1
        ) d
      ) agg ON true
      WHERE lower(COALESCE(p.gender, '')) = 'female'
        AND NOT public.has_role(p.user_id, 'admin'::app_role)
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_women_scoreboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_women_scoreboard() TO authenticated, service_role;

-- Admin directory: every non-admin user with presence + recharge flag
CREATE OR REPLACE FUNCTION public.get_admin_user_directory()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x)::jsonb)
    FROM (
      SELECT
        p.user_id,
        COALESCE(p.full_name, 'User') AS full_name,
        p.gender,
        p.photo_url,
        COALESCE(us.is_online, false) AS is_online,
        us.last_seen,
        EXISTS (
          SELECT 1
            FROM public.wallet_transactions wt
           WHERE wt.user_id = p.user_id
             AND wt.type = 'credit'
             AND wt.transaction_type = 'recharge'
        ) AS has_recharged
      FROM public.profiles p
      LEFT JOIN public.user_status us ON us.user_id = p.user_id
      WHERE NOT public.has_role(p.user_id, 'admin'::app_role)
      ORDER BY COALESCE(us.is_online, false) DESC, us.last_seen DESC NULLS LAST
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_directory() TO authenticated, service_role;
