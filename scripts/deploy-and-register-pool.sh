#!/usr/bin/env bash
# Deploy CleanverseCompliancePool and register with Validator API.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_A_PRIVATE_KEY:?}"

export CLEANVERSE_VALIDATOR=0xaC7e5179C2C7f03f209136886c172eb34F161792
export CLEARNOTE_POLICY=0xa36F46f2631bc092E319d7Ab4cCAA97b9cD63890
export POOL_OWNER=0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB

echo "=== Step 1: deploy CleanverseCompliancePool ==="
DEPLOY_OUT=$(forge script contracts/script/DeployCompliancePool.s.sol:DeployCompliancePool \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast --json 2>/dev/null | tail -1)
POOL=$(echo "$DEPLOY_OUT" | jq -r '.returns.pool.value // empty')
if [[ -z "$POOL" || "$POOL" == "null" ]]; then
  # fallback: parse from receipts
  POOL=$(forge script contracts/script/DeployCompliancePool.s.sol:DeployCompliancePool \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast 2>&1 | grep -oP '0x[a-fA-F0-9]{40}' | tail -1)
fi
echo "POOL=$POOL"
[[ -n "$POOL" ]] || { echo "FAIL: deploy"; exit 1; }

echo "=== Step 2: verify owner() ==="
OWNER=$(cast call "$POOL" "owner()(address)" --rpc-url "$RPC")
echo "owner=$OWNER"
[[ "${OWNER,,}" == "${POOL_OWNER,,}" ]] || { echo "FAIL: owner mismatch"; exit 1; }

echo "=== Step 3: validator/register ==="
node "$ROOT/scripts/validator-register-pool.mjs" "$POOL"
echo "PASS: deploy + register pipeline"
