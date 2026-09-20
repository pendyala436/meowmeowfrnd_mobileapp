#!/usr/bin/env bash
# Apply only pending Supabase migrations on the VPS via docker exec into supabase-db.
# Uses supabase_admin (postgres role often lacks CREATE on public on this host).
#
# If the live DB already has schema but schema_migrations is incomplete
# (common on self-hosted catch-up), pending files that error with
# "already exists" are recorded as applied instead of failing the deploy.
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

record_version() {
  local version="$1"
  psql_q -c "INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('${version}') ON CONFLICT (version) DO NOTHING;" >/dev/null
}

is_recorded() {
  local version="$1"
  local full_version="$2"
  psql_q -tAc "
    SELECT 1 FROM supabase_migrations.schema_migrations
    WHERE version IN ('${version}', '${full_version}')
       OR version LIKE '${version}_%'
    LIMIT 1
  " | tr -d '[:space:]'
}

is_already_applied_error() {
  grep -qiE 'already exists|duplicate key|already a member|conflict' <<<"$1"
}

# Ensure migration history table exists (self-hosted Supabase).
psql_q -c "
  CREATE SCHEMA IF NOT EXISTS supabase_migrations;
  CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
    version text PRIMARY KEY
  );
" >/dev/null

history_count="$(psql_q -tAc "SELECT count(*) FROM supabase_migrations.schema_migrations;" | tr -d '[:space:]')"
file_count="$(ls "$MIG_DIR"/*.sql 2>/dev/null | wc -l | tr -d '[:space:]')"
echo "==> Migration history: ${history_count} recorded, ${file_count} files on disk"

pending_files=()
for f in $(ls "$MIG_DIR"/*.sql | sort); do
  base="$(basename "$f")"
  version="${base%%_*}"
  full_version="${base%.sql}"
  if [ "$(is_recorded "$version" "$full_version")" != "1" ]; then
    pending_files+=("$f")
  fi
done

if [ "${#pending_files[@]}" -eq 0 ]; then
  echo "==> No pending migrations"
  exit 0
fi

echo "==> ${#pending_files[@]} pending migration(s)"

# If the DB already looks provisioned but history is far behind, baseline
# missing versions once instead of replaying years of CREATE TABLE.
profiles_exists="$(
  psql_q -tAc "
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
    LIMIT 1
  " | tr -d '[:space:]'
)"
pending_count="${#pending_files[@]}"

if [ "$profiles_exists" = "1" ] && [ "$pending_count" -gt 10 ]; then
  echo "==> Schema already present but ${pending_count} versions missing from history."
  echo "    Baselining those versions WITHOUT re-running SQL (catch-up)."
  for f in "${pending_files[@]}"; do
    base="$(basename "$f")"
    version="${base%%_*}"
    record_version "$version"
  done
  echo "==> Baselined ${pending_count} migration(s). Future new files will apply normally."
  exit 0
fi

applied=0
baselined=0
skipped=$((file_count - pending_count))

for f in "${pending_files[@]}"; do
  base="$(basename "$f")"
  version="${base%%_*}"

  echo "  -> $base"
  set +e
  output="$(psql_q < "$f" 2>&1)"
  status=$?
  set -e

  if [ "$status" -eq 0 ]; then
    record_version "$version"
    applied=$((applied + 1))
    continue
  fi

  if is_already_applied_error "$output"; then
    echo "     already on DB; recording ${version} and continuing"
    record_version "$version"
    baselined=$((baselined + 1))
    continue
  fi

  echo "$output"
  echo "ERROR: migration failed: $base"
  exit "$status"
done

echo "==> Migrations done: ${applied} applied, ${baselined} baselined (already on DB), ${skipped} already recorded"
