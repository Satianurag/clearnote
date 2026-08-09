#!/usr/bin/env bash
# Build audit pack + anchor hash on AuditAnchor via Safe (WO-12).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ID="${1:-INV-001}"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
ANCHOR=$(jq -r .auditAnchor "$DEPLOY")
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"
OUT="$ROOT/seed/audit-packs/${ID}.json"

PACK=$(node "$ROOT/scripts/audit-pack.mjs" "$ID")

PACK_HASH=$(echo "$PACK" | jq -r .packHash)
URI="file://seed/audit-packs/${ID}.json"
NOW=$(date +%s)
START=$((NOW - 86400))
END=$NOW

DATA=$(cast calldata "anchor(bytes32,string,uint64,uint64)" "$PACK_HASH" "$URI" "$START" "$END")
echo "=== Safe anchor audit pack $ID hash=$PACK_HASH ==="
TX=$(bash "$SAFE_EXEC" "$ANCHOR" "$DATA")
echo "anchor: $TX"
jq --arg tx "$TX" --arg id "$ID" '.e2e["auditAnchor_\($id)"] = $tx' "$DEPLOY" > "${DEPLOY}.tmp" && mv "${DEPLOY}.tmp" "$DEPLOY"
