#!/usr/bin/env bash
# Runs the migrations on real Postgres: a fresh install, a repeat run (they must be idempotent), and an upgrade
# of a database that already has data. Needs a Postgres with pgvector (CI uses pgvector/pgvector:pg16).
#   PGHOST/PGPORT/PGUSER/PGPASSWORD select the server. SKIP_VECTOR=1 drops the vector section for servers without pgvector.
set -euo pipefail
cd "$(dirname "$0")/../.."
dir=supabase/migrations
base=$(ls $dir/*.sql | head -1)
rest=$(ls $dir/*.sql | tail -n +2)
psqlx() { psql -q -v ON_ERROR_STOP=1 "$@" 2> >(grep -v -E 'NOTICE|WARNING|HINT' >&2); }
prep() {  # $1 file -> stdout (optionally without the vector section)
  if [ "${SKIP_VECTOR:-}" = 1 ]; then python3 -c "import sys; s=open(sys.argv[1]).read(); i=s.find('-- ───────────────────────── vector search'); print(s if i<0 else s[:i])" "$1"; else cat "$1"; fi
}
fresh() { psql -q -c "drop database if exists $1" -c "create database $1" 2>/dev/null; psqlx -d "$1" -f supabase/test/stubs.sql; }

echo "== fresh install"
fresh gp_fresh
for f in $base $rest; do prep "$f" | psqlx -d gp_fresh; done
echo "== applying every migration again (idempotency)"
for f in $base $rest; do prep "$f" | psqlx -d gp_fresh; done

echo "== upgrade of a database with data"
fresh gp_upgrade
prep "$base" | psqlx -d gp_upgrade
psqlx -d gp_upgrade -f supabase/test/seed_before_upgrade.sql
for f in $rest; do prep "$f" | psqlx -d gp_upgrade; done
psqlx -d gp_upgrade -f supabase/test/assert_after_upgrade.sql
echo "migrations OK"
