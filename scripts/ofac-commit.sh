#!/usr/bin/env bash
# Commit OFAC merkle root on SanctionsRegistry via Safe (WO-03).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
SANCTIONS=$(jq -r .sanctions "$DEPLOY")
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"
OFAC="$ROOT/seed/ofac/ofac-root.json"

node "$ROOT/scripts/ofac-build.mjs"
ROOT_HEX=$(jq -r .root "$OFAC")
URI=$(jq -r .sourceUri "$OFAC")
DATE=$(jq -r .sourceDate "$OFAC")
PUBLISHED=$(date -d "$DATE" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$DATE" +%s 2>/dev/null || echo 1722902400)

DATA=$(cast calldata "commitRoot(bytes32,string,uint64)" "$ROOT_HEX" "$URI" "$PUBLISHED")
echo "=== Safe commitRoot on SanctionsRegistry ==="
TX=$(bash "$SAFE_EXEC" "$SANCTIONS" "$DATA")
echo "commitRoot: $TX"

jq ".e2e.ofacCommitRoot = \"$TX\"" "$DEPLOY" > "${DEPLOY}.tmp" && mv "${DEPLOY}.tmp" "$DEPLOY"
