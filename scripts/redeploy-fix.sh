#!/usr/bin/env bash
# Redeploy Controller + Policy (audit fixes) + DvPEscrow; wire registry, CLINV01, Safe roles.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"

REGISTRY=$(jq -r .registry "$DEPLOY")
OLD_CONTROLLER=$(jq -r .controller "$DEPLOY")
OLD_POLICY=$(jq -r '.policy // .policyV3_1' "$DEPLOY")
OLD_DVPE=$(jq -r .dvpEscrow "$DEPLOY")
CLINV01=$(jq -r .e2e.clinv01 "$DEPLOY")
BASE=$(jq -r .baseRouter "$DEPLOY")
APASS=$(jq -r .apassRegistry "$DEPLOY")
SAFE=0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593
SANCTIONED=0x1111111111111111111111111111111111111111
OFAC="$ROOT/seed/ofac/ofac-root.json"

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_A_PRIVATE_KEY:?}"

echo "=== Redeploy audit fix (Controller + Policy + DvPEscrow) ==="
echo "Registry:      $REGISTRY (unchanged)"
echo "Old controller: $OLD_CONTROLLER"
echo "Old policy:     $OLD_POLICY"
echo "CLINV01:        $CLINV01"

# Reuse OFAC root for policy commitRoot
ROOT_HEX=$(jq -r .root "$OFAC")
URI=$(jq -r .sourceUri "$OFAC")
DATE=$(jq -r .sourceDate "$OFAC")
PUBLISHED=$(date -d "$DATE" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$DATE" +%s 2>/dev/null || echo 1722902400)

echo "=== Deploy ClearNoteController (admin=Safe, defaultLockup=0) ==="
OUT_CTRL=$(cd "$ROOT" && forge create contracts/src/ClearNoteController.sol:ClearNoteController \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast \
  --constructor-args "$REGISTRY" "$SAFE" 0 2>&1)
NEW_CONTROLLER=$(echo "$OUT_CTRL" | grep "Deployed to:" | awk '{print $3}')
echo "New Controller: $NEW_CONTROLLER"

echo "=== Deploy ClearNotePolicy v3.2 (admin=Safe) ==="
OUT_POL=$(cd "$ROOT" && forge create contracts/src/ClearNotePolicy.sol:ClearNotePolicy \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast \
  --constructor-args "$BASE" "$NEW_CONTROLLER" "$REGISTRY" "$APASS" 50 "$SAFE" 2>&1)
NEW_POLICY=$(echo "$OUT_POL" | grep "Deployed to:" | awk '{print $3}')
echo "New Policy: $NEW_POLICY"

CONTROLLER_ROLE=$(cast call "$REGISTRY" "CONTROLLER_ROLE()(bytes32)" --rpc-url "$RPC")

echo "=== Safe: grant CONTROLLER_ROLE on Registry → new controller ==="
TX_GRANT_CTRL=$(bash "$SAFE_EXEC" "$REGISTRY" \
  "$(cast calldata "grantRole(bytes32,address)" "$CONTROLLER_ROLE" "$NEW_CONTROLLER")")

echo "=== Safe: revoke CONTROLLER_ROLE from old controller ==="
TX_REVOKE_CTRL=$(bash "$SAFE_EXEC" "$REGISTRY" \
  "$(cast calldata "revokeRole(bytes32,address)" "$CONTROLLER_ROLE" "$OLD_CONTROLLER")")

ISSUER_ROLE=$(cast call "$NEW_CONTROLLER" "ISSUER_ROLE()(bytes32)" --rpc-url "$RPC")
echo "=== Safe: grant ISSUER_ROLE on new controller → Safe ==="
TX_ISSUER=$(bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "grantRole(bytes32,address)" "$ISSUER_ROLE" "$SAFE")")

echo "=== Safe: CLINV01 controller config ==="
TX_MAX_INV=$(bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "setMaxInvestors(address,uint32)" "$CLINV01" 100)")
TX_MAX_POS=$(bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "setMaxPositionBps(address,uint16)" "$CLINV01" 10000)")
TX_LOCKUP=$(bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "setLockup(address,uint64)" "$CLINV01" 86400)")

echo "=== Safe: policy OFAC root + demo sanction ==="
TX_COMMIT=$(bash "$SAFE_EXEC" "$NEW_POLICY" \
  "$(cast calldata "commitRoot(bytes32,uint64,string)" "$ROOT_HEX" "$PUBLISHED" "$URI")")
TX_SANCTION=$(bash "$SAFE_EXEC" "$NEW_POLICY" \
  "$(cast calldata "setSanctioned(address,bool)" "$SANCTIONED" true)")

echo "=== Wallet A: CLINV01 setPolicy → new policy ==="
TX_SET_POLICY=$(cast send "$CLINV01" "setPolicy(address)" "$NEW_POLICY" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash)

MINTER_ROLE=0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
OLD_CTRL=$(jq -r .controller_deprecated "$DEPLOY" 2>/dev/null || echo "$OLD_CONTROLLER")
echo "=== Wallet A: grant CLINV01 MINTER_ROLE → new controller ==="
TX_MINTER_GRANT=$(cast send "$CLINV01" "grantRole(bytes32,address)" "$MINTER_ROLE" "$NEW_CONTROLLER" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash)
if [[ -n "$OLD_CTRL" && "$OLD_CTRL" != "null" ]]; then
  echo "=== Wallet A: revoke CLINV01 MINTER from old controller ==="
  cast send "$CLINV01" "revokeRole(bytes32,address)" "$MINTER_ROLE" "$OLD_CTRL" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
fi

echo "=== Deploy DvPEscrow (immutable controller = new) ==="
OUT_DVPE=$(cd "$ROOT" && forge create contracts/src/DvPEscrow.sol:DvPEscrow \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast \
  --constructor-args "$NEW_CONTROLLER" "$SAFE" 2>&1)
NEW_DVPE=$(echo "$OUT_DVPE" | grep "Deployed to:" | awk '{print $3}')
echo "New DvPEscrow: $NEW_DVPE"

ESCROW_ROLE=$(cast call "$NEW_CONTROLLER" "ESCROW_ROLE()(bytes32)" --rpc-url "$RPC")
echo "=== Safe: grant ESCROW_ROLE → new DvPEscrow ==="
TX_ESCROW=$(bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "grantRole(bytes32,address)" "$ESCROW_ROLE" "$NEW_DVPE")")

POL_ON_TOKEN=$(cast call "$CLINV01" "policy()(address)" --rpc-url "$RPC")
echo "CLINV01 policy now: $POL_ON_TOKEN"

# Update deployments JSON (canonical keys: policy, policyNote, policyHistory)
NOTE="v3.2 bytecode: ApassLookupFailed fail-closed tier gate; onTransfer no secondary lockup reset."
jq \
  --arg oc "$OLD_CONTROLLER" \
  --arg op "$OLD_POLICY" \
  --arg od "$OLD_DVPE" \
  --arg nc "$NEW_CONTROLLER" \
  --arg np "$NEW_POLICY" \
  --arg nd "$NEW_DVPE" \
  --arg tsp "$TX_SET_POLICY" \
  --arg te "$TX_ESCROW" \
  --arg tg "$TX_GRANT_CTRL" \
  --arg note "$NOTE" \
  '.controller = $nc
   | .policy = $np
   | .policyNote = $note
   | .controller_deprecated = $oc
   | .dvpEscrow = $nd
   | .dvpEscrow_deprecated = $od
   | .policyHistory = (
       [{label: "v3.2-live", address: $np, setPolicyTx: $tsp}]
       + ([.policyHistory[]? | select(.address != $np)])
     )
   | .e2e.clinv01SetPolicyV32 = $tsp
   | .e2e.controllerRedeployGrant = $tg
   | .e2e.dvpeGrantEscrow = $te
   | .e2e.controllerRedeployAt = "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"' \
  "$DEPLOY" > "${DEPLOY}.tmp"
mv "${DEPLOY}.tmp" "$DEPLOY"

echo "=== Redeploy complete ==="
echo "controller=$NEW_CONTROLLER"
echo "policy=$NEW_POLICY"
echo "dvpEscrow=$NEW_DVPE"
echo "setPolicy=$TX_SET_POLICY"
