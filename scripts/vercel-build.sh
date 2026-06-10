#!/usr/bin/env bash
# Vercel (and `npm run build`) build step. Applies the Prisma schema to the
# database on deploy, then builds Next.
#
# Why this script exists: `prisma db push` needs Neon's DIRECT (non-pooled)
# connection — the pooled URL (PgBouncer) blocks the DDL/advisory locks db push
# uses, which is what made earlier deploys fail. The app runtime still uses the
# pooled DATABASE_URL (via the PrismaPg adapter in lib/db.ts); only this build
# step uses the direct URL. The direct URL is derived from DATABASE_URL by
# stripping "-pooler" from the Neon host, unless DIRECT_DATABASE_URL is set.
set -euo pipefail

npx prisma generate

DIRECT="${DIRECT_DATABASE_URL:-$(printf '%s' "${DATABASE_URL:-}" | sed 's/-pooler//')}"
if [ -n "$DIRECT" ]; then
  echo "→ applying schema (prisma db push, direct connection)"
  npx prisma db push --url "$DIRECT"
else
  echo "⚠ DATABASE_URL not set — skipping prisma db push"
fi

npx next build
