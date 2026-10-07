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
#
# The push is gated: previews of feature branches run with the PRODUCTION
# DATABASE_URL, so pushing from any branch would let an unmerged schema change
# rewrite the production database. Only production deploys, `dev` previews
# (they get their own Neon branch) and local / non-Vercel builds push.
set -euo pipefail

npx prisma generate

should_push_schema() {
  [ -z "${VERCEL:-}" ] && return 0
  [ "${VERCEL_ENV:-}" = "production" ] && return 0
  [ "${VERCEL_GIT_COMMIT_REF:-}" = "dev" ] && return 0
  return 1
}

DIRECT="${DIRECT_DATABASE_URL:-$(printf '%s' "${DATABASE_URL:-}" | sed 's/-pooler//')}"
if ! should_push_schema; then
  echo "↷ skipping prisma db push: ${VERCEL_ENV:-unknown} build of '${VERCEL_GIT_COMMIT_REF:-unknown}' (only production, dev previews and local builds apply the schema)"
elif [ -n "$DIRECT" ]; then
  echo "→ applying schema (prisma db push, direct connection)"
  npx prisma db push --url "$DIRECT"
else
  echo "⚠ DATABASE_URL not set — skipping prisma db push"
fi

npx next build
