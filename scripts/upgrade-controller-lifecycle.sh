#!/usr/bin/env bash
# Deploy upgraded ClearNoteController (settle + markDefault) and wire Safe roles.
# Registry, policy, and CLINV01 addresses stay unchanged.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"
SAFE=0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_A_PRIVATE_KEY:?}"

REGISTRY=$(jq -r .registry "$DEPLOY")
OLD_CONTROLLER=$(jq -r .controller "$DEPLOY")
CLINV01=$(jq -r .e2e.clinv01 "$DEPLOY")

echo "=== Upgrade ClearNoteController (lifecycle: settle + markDefault) ==="
echo "Registry:       $REGISTRY"
echo "Old controller: $OLD_CONTROLLER"

OUT_CTRL=$(cd "$ROOT" && forge create contracts/src/ClearNoteController.sol:ClearNoteController \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --broadcast \
  --constructor-args "$REGISTRY" "$SAFE" 0 2>&1)
NEW_CONTROLLER=$(echo "$OUT_CTRL" | grep "Deployed to:" | awk '{print $3}')
echo "New controller: $NEW_CONTROLLER"

CONTROLLER_ROLE=$(cast call "$REGISTRY" "CONTROLLER_ROLE()(bytes32)" --rpc-url "$RPC")
ISSUER_ROLE=$(cast call "$NEW_CONTROLLER" "ISSUER_ROLE()(bytes32)" --rpc-url "$RPC")

echo "=== Safe: grant CONTROLLER_ROLE on Registry → new controller ==="
bash "$SAFE_EXEC" "$REGISTRY" \
  "$(cast calldata "grantRole(bytes32,address)" "$CONTROLLER_ROLE" "$NEW_CONTROLLER")"

echo "=== Safe: revoke CONTROLLER_ROLE from old controller ==="
bash "$SAFE_EXEC" "$REGISTRY" \
  "$(cast calldata "revokeRole(bytes32,address)" "$CONTROLLER_ROLE" "$OLD_CONTROLLER")"

echo "=== Safe: grant ISSUER_ROLE on new controller → Safe ==="
bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "grantRole(bytes32,address)" "$ISSUER_ROLE" "$SAFE")"

echo "=== Safe: CLINV01 controller config ==="
bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "setMaxInvestors(address,uint32)" "$CLINV01" 100)"
bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "setMaxPositionBps(address,uint16)" "$CLINV01" 10000)"
bash "$SAFE_EXEC" "$NEW_CONTROLLER" \
  "$(cast calldata "setLockup(address,uint64)" "$CLINV01" 86400)"

POLICY=$(jq -r '.policy // .policyV3_1' "$DEPLOY")
echo "=== Safe: point CLINV01 policy at existing policy ==="
bash "$SAFE_EXEC" "$CLINV01" "$(cast calldata "setPolicy(address)" "$POLICY")"

TMP=$(mktemp)
jq --arg c "$NEW_CONTROLLER" '.controller = $c | .controllerV3_2 = $c' "$DEPLOY" > "$TMP"
mv "$TMP" "$DEPLOY"

APP_ENV="$ROOT/app/.env.local"
if [[ -f "$APP_ENV" ]]; then
  sed -i "s|^NEXT_PUBLIC_CONTROLLER=.*|NEXT_PUBLIC_CONTROLLER=$NEW_CONTROLLER|" "$APP_ENV" || true
fi

echo "=== Done ==="
echo "Update NEXT_PUBLIC_CONTROLLER=$NEW_CONTROLLER in app/.env.local if not auto-patched"
echo "Restart pnpm dev and re-run Envio codegen if indexer events changed"
