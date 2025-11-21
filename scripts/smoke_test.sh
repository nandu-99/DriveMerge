#!/usr/bin/env bash
set -euo pipefail
BASE=http://127.0.0.1:3000
EMAIL="e2e_test@example.com"
PASSWORD="Password123"

echo "1) Register (may fail if user exists)"
curl -sS -X POST "$BASE/auth/register" -H 'Content-Type: application/json' -d "{\"name\":\"E2E Test\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq || true

echo
echo "2) Login"
LOGIN_RESP=$(curl -sS -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
echo "$LOGIN_RESP" | jq
TOKEN=$(echo "$LOGIN_RESP" | jq -r .token)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "No token returned; aborting further authenticated calls"
  exit 0
fi

echo
echo "3) Profile (GET /auth/me)"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/auth/me" | jq

echo
echo "4) DB-backed files (GET /drive/files)"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/drive/files" | jq

echo
echo "5) Try thumbnail for dummy id (expected 404 or 500 if Drive not connected)"
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/drive/files/thumbnail?id=nonexistent&size=240" -i || true

echo
echo "Done"
