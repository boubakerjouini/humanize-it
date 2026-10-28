#!/usr/bin/env bash
# Webhook and health probe (.github/workflows/webhook-probe.yml). Sends
# unsigned requests, which every webhook rejects at verification before it
# reads or writes anything, and checks each answer against the one a healthy,
# configured endpoint gives:
#   clerk  {} with no svix headers      -> 400 (500 = CLERK_WEBHOOK_SECRET unset)
#   polar  {} with no signature         -> 403 (500 = POLAR_WEBHOOK_SECRET unset)
#   resend {} with dummy svix headers   -> 400 (500 = RESEND_WEBHOOK_SECRET unset;
#          without the headers it answers 400 before reading the secret)
#   GET /api/health                     -> 200 (503 = database down)
# A stale or rotated secret still answers 400/403, so it can't be seen from
# here; the daily ops check (lib/ops/checks.ts) covers silent webhooks.
# Prints status codes only. Exits 1 on any mismatch.
set -uo pipefail

BASE_URL="${PROBE_BASE_URL:-https://humanizeit.app}"
failed=0

probe() {
  local name="$1" expected="$2"; shift 2
  local got
  got=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$@")
  if [ "$got" = "$expected" ]; then
    echo "ok    $name: $got"
  else
    echo "FAIL  $name: expected $expected, got $got"
    failed=1
  fi
}

json=(-H 'content-type: application/json' --data '{}')
probe "clerk webhook" "${EXPECT_CLERK:-400}" -X POST "${json[@]}" "$BASE_URL/api/webhooks/clerk"
probe "polar webhook" "${EXPECT_POLAR:-403}" -X POST "${json[@]}" "$BASE_URL/api/webhooks/polar"
probe "resend webhook" "${EXPECT_RESEND:-400}" -X POST "${json[@]}" \
  -H 'svix-id: msg_probe' -H "svix-timestamp: $(date +%s)" -H 'svix-signature: v1,cHJvYmU=' \
  "$BASE_URL/api/webhooks/resend"
probe "health" "${EXPECT_HEALTH:-200}" "$BASE_URL/api/health"

exit "$failed"
