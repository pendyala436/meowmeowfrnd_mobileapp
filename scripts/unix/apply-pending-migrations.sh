#!/usr/bin/env bash
# Apply only pending Supabase migrations on the VPS via docker exec into supabase-db.
# Uses supabase_admin (postgres role often lacks CREATE on public on this host).
set -euo pipefail

APP_DIR="${1:-$(pwd)}"
MIG_DIR="$APP_DIR/supabase/migrations"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db}"
DB_USER="${SUPABASE_DB_USER:-supabase_admin}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"

if [ ! -d "$MIG_DIR" ]; then
  echo "Migrations directory not found: $MIG_DIR"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "Database container not running: $DB_CONTAINER"
  exit 1
fi

psql_q() {
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

# Ensure migration history table exists (self-hosted Supabase).
psql_q -c "
  CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY
  );
" >/dev/null

echo "==> Applying pending migrations from $MIG_DIR"
applied=0
skipped=0

# Sort by filename so timestamp order is preserved.
for f in $(ls "$MIG_DIR"/*.sql | sort); do
  base="$(basename "$f")"
  version="${base%%_*}"
  full_version="${base%.sql}"

  exists="$(
    psql_q -tAc "
      SELECT 1 FROM supabase_migrations.schema_migrations
      WHERE version IN ('${version}', '${full_version}')
         OR version LIKE '${version}_%'
      LIMIT 1
    " | tr -d '[:space:]'
  )"

  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi

  echo "  -> $base"
  psql_q < "$f" >/dev/null
  psql_q -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING;" >/dev/null
  applied=$((applied + 1))
done

echo "==> Migrations done: ${applied} applied, ${skipped} already present"
