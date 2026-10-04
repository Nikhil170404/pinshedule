#!/usr/bin/env bash
# supabase-schema.sql is the migrations concatenated in order, for pasting into the Supabase SQL editor.
# Run this after adding a migration. CI runs it with --check.
set -euo pipefail
cd "$(dirname "$0")/.."
out=$(mktemp)
for f in supabase/migrations/*.sql; do
  printf -- '-- ===== %s =====\n' "$(basename "$f")" >> "$out"
  cat "$f" >> "$out"
  printf '\n' >> "$out"
done
if [ "${1:-}" = "--check" ]; then
  diff -q "$out" supabase-schema.sql >/dev/null || { echo "supabase-schema.sql is out of date. Run scripts/build-schema.sh" >&2; exit 1; }
else
  mv "$out" supabase-schema.sql
fi
