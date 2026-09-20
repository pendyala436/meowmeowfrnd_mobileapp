-- CI smoke probe: proves deploy applies NEW migration SQL (not only baseline).
-- Safe no-op for product behavior. Inspect with:
--   SELECT * FROM public._ci_migration_smoke;

CREATE TABLE IF NOT EXISTS public._ci_migration_smoke (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_ran_at timestamptz NOT NULL DEFAULT now(),
  note text NOT NULL DEFAULT 'ok'
);

INSERT INTO public._ci_migration_smoke (id, last_ran_at, note)
VALUES (1, now(), 'ci_smoke_20260920080000')
ON CONFLICT (id) DO UPDATE
SET last_ran_at = excluded.last_ran_at,
    note = excluded.note;

COMMENT ON TABLE public._ci_migration_smoke IS
  'Deploy probe table updated by *_ci_smoke_* migrations. Safe to keep.';
