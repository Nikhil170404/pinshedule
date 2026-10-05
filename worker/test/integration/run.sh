#!/usr/bin/env bash
# Integration tests: a real Postgres (pgvector) and PostgREST in Docker, with the worker's other dependencies
# (Pinterest, Upstash Redis, Supabase storage) faked in-process. Requires Docker. Run: npm run test:integration
set -euo pipefail
cd "$(dirname "$0")/../../.."          # repo root
DIR=worker/test/integration
PG=gpk-it-pg; REST=gpk-it-rest; PGPORT=55433; RESTPORT=3301
SECRET="integration-test-jwt-secret-0123456789abcdef"

cleanup() { docker rm -f "$PG" "$REST" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

docker run -d --name "$PG" -e POSTGRES_PASSWORD=pw -p "$PGPORT":5432 pgvector/pgvector:pg16 >/dev/null
for _ in $(seq 1 40); do docker exec "$PG" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
sleep 2
psql() { docker exec -i "$PG" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql -c 'alter database postgres set search_path = "$user", public, extensions;'
psql < "$DIR/stub.sql" 2>/dev/null
psql < supabase-schema.sql 2>&1 | grep -E "^ERROR" || true
psql <<'SQL'
create role authenticator login password 'pw' noinherit;
grant anon, authenticated, service_role to authenticator;
alter role service_role bypassrls;
grant usage on schema public, extensions to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
SQL

docker run -d --name "$REST" -p "$RESTPORT":3000 \
  -e PGRST_DB_URI="postgres://authenticator:pw@host.docker.internal:$PGPORT/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SECRET" \
  postgrest/postgrest:latest >/dev/null
for _ in $(seq 1 40); do curl -s -o /dev/null "http://127.0.0.1:$RESTPORT/" && break; sleep 1; done

export IT_PG_CONTAINER="$PG" IT_REST_PORT="$RESTPORT" IT_JWT_SECRET="$SECRET"
cd worker && npx tsx --test --test-concurrency=1 test/integration/*.test.ts
