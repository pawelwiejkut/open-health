#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
COOKIE=/tmp/oh_cookies.txt
rm -f "$COOKIE"

echo "[1] CSRF"
CSRF=$(curl -sS -c "$COOKIE" "$BASE/api/auth/csrf" | jq -r .csrfToken)
[ -n "$CSRF" ]

echo "[2] Register"
USER="smoke_$RANDOM"
curl -sS -X POST "$BASE/api/auth/register" -H 'content-type: application/json' -d '{"username":"'"$USER"'","password":"test1234"}' | jq .

echo "[3] Login"
curl -sS -i -c "$COOKIE" -b "$COOKIE" -X POST "$BASE/api/auth/callback/credentials?json=true" \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data "csrfToken=$CSRF&username=$USER&password=test1234&redirect=false&callbackUrl=$BASE" >/dev/null

echo "[4] Assistant modes & LLM providers"
curl -sS -b "$COOKIE" "$BASE/api/assistant-modes" | jq '.assistantModes | length'
curl -sS -b "$COOKIE" "$BASE/api/llm-providers" | jq '.llmProviders | length'

echo "[5] Create chat room"
curl -sS -b "$COOKIE" -X POST "$BASE/api/chat-rooms" | jq '.id'

echo "[6] Upload PDF"
curl -sS -L -o /tmp/smoke.pdf https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
ID="smk-$RANDOM"
RESP=$(curl -sS -b "$COOKIE" -X POST "$BASE/api/health-data" -F id=$ID -F file=@/tmp/smoke.pdf)
echo "$RESP" | jq '.status, .fileType'

echo "[7] Poll status"
for i in $(seq 1 30); do
  ST=$(curl -sS -b "$COOKIE" "$BASE/api/health-data/$ID" | jq -r .healthData.status)
  [ "$ST" = "COMPLETED" ] && break
  sleep 1
done
[ "$ST" = "COMPLETED" ]

echo "[8] Docling health"
curl -sS "$BASE/api/health/docling" | jq .ok

echo "Smoke tests: OK"

