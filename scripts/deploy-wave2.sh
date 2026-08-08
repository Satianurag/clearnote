#!/usr/bin/env bash
# Deploy DvPEscrow + AuditAnchor on Monad testnet; wire ESCROW_ROLE via Safe.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
CONTROLLER=$(jq -r .controller "$DEPLOY")
SAFE=0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_A_PRIVATE_KEY:?}"
: "${WALLET_B2_PRIVATE_KEY:?}"

echo "=== Deploy DvPEscrow ==="
OUT=$(cd "$ROOT" && forge create contracts/src/DvPEscrow.sol:DvPEscrow \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast \
  --constructor-args "$CONTROLLER" "$SAFE" 2>&1)
DVPE=$(echo "$OUT" | grep "Deployed to:" | awk '{print $3}')
echo "DvPEscrow: $DVPE"

echo "=== Deploy AuditAnchor ==="
OUT2=$(cd "$ROOT" && forge create contracts/src/AuditAnchor.sol:AuditAnchor \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast \
  --constructor-args "$SAFE" 2>&1)
ANCHOR=$(echo "$OUT2" | grep "Deployed to:" | awk '{print $3}')
echo "AuditAnchor: $ANCHOR"

ESCROW_ROLE=$(cast call "$CONTROLLER" "ESCROW_ROLE()(bytes32)" --rpc-url "$RPC")
DATA=$(cast calldata "grantRole(bytes32,address)" "$ESCROW_ROLE" "$DVPE")
echo "=== Safe grant ESCROW_ROLE to DvPEscrow ==="
TX=$(bash "$SAFE_EXEC" "$CONTROLLER" "$DATA")
echo "grantRole: $TX"

# Sanction demo address on live policy
POLICY=$(jq -r '.policy // .policyV3_1' "$DEPLOY")
SANCTIONED=0x1111111111111111111111111111111111111111
DATA2=$(cast calldata "setSanctioned(address,bool)" "$SANCTIONED" true)
echo "=== Safe setSanctioned on policy ==="
TX2=$(bash "$SAFE_EXEC" "$POLICY" "$DATA2")
echo "setSanctioned: $TX2"

# Revoke MINTER from A on CLINV01 if still granted
A=0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB
CLINV01=$(jq -r .e2e.clinv01 "$DEPLOY")
MINTER=0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
HAS=$(cast call "$CLINV01" "hasRole(bytes32,address)(bool)" "$MINTER" "$A" --rpc-url "$RPC" 2>/dev/null || echo false)
if [[ "$HAS" == "true" ]]; then
  echo "=== Revoke MINTER from A on CLINV01 (direct — A is token admin) ==="
  cast send "$CLINV01" "revokeRole(bytes32,address)" "$MINTER" "$A" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
fi

jq ".dvpEscrow = \"$DVPE\" | .auditAnchor = \"$ANCHOR\" | .e2e.dvpeGrantEscrow = \"$TX\"" "$DEPLOY" > "${DEPLOY}.tmp"
mv "${DEPLOY}.tmp" "$DEPLOY"
echo "=== Deploy wiring done ==="
