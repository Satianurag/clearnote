#!/usr/bin/env bash
# Expose local Hasura (port 8082) to the internet for Vercel production.
# After start, set INDEXER_GRAPHQL_URL on Vercel to: https://<host>/v1/graphql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="${ROOT}/.run/indexer-tunnel.log"
PORT="${HASURA_EXTERNAL_PORT:-8082}"

mkdir -p "${ROOT}/.run"

if pgrep -f "cloudflared tunnel --url http://localhost:${PORT}" >/dev/null 2>&1; then
  echo "Indexer tunnel already running. Log: ${LOG}"
  grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${LOG}" 2>/dev/null | tail -1 || true
  exit 0
fi

echo "Starting Cloudflare quick tunnel → http://localhost:${PORT}"
echo "Log: ${LOG}"
nohup cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate >>"${LOG}" 2>&1 &
sleep 4
URL=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${LOG}" | tail -1 || true)
if [[ -z "${URL}" ]]; then
  echo "Tunnel URL not ready yet — check ${LOG}"
  exit 1
fi
echo "Public GraphQL: ${URL}/v1/graphql"
echo "Set on Vercel: INDEXER_GRAPHQL_URL=${URL}/v1/graphql"
