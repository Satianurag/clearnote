#!/usr/bin/env bash
# Post DvP offer on testnet with aUSDC cash leg (seller = B2).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_B2_PRIVATE_KEY:?}"

CLINV01=$(jq -r .e2e.clinv01 "$DEPLOY")
AUSDC=0xaC0893567D43C3E7e6e35a72803df05416C1f20D
DVP=$(jq -r .dvpEscrow "$DEPLOY")
UNITS=1000000000000000000
PRICE=1000000
EXPIRY=$(( $(date +%s) + 604800 ))

echo "=== Approve CLINV01 for DvPEscrow ==="
cast send "$CLINV01" "approve(address,uint256)" "$DVP" "$UNITS" \
  --rpc-url "$RPC" --private-key "$WALLET_B2_PRIVATE_KEY" --json | jq -r .transactionHash

echo "=== Post offer (cashToken = aUSDC) ==="
TX=$(cast send "$DVP" \
  "postOffer(address,address,uint256,uint256,uint256,uint64)" \
  "$CLINV01" "$AUSDC" "$UNITS" "$PRICE" "$UNITS" "$EXPIRY" \
  --rpc-url "$RPC" --private-key "$WALLET_B2_PRIVATE_KEY" --json | jq -r .transactionHash)
echo "tx: $TX"
echo "https://testnet.monadscan.com/tx/$TX"

NEXT=$(cast call "$DVP" "nextOfferId()(uint256)" --rpc-url "$RPC")
OFFER_ID=$((NEXT - 1))
CASH=$(cast call "$DVP" "offers(uint256)(address,address,address,uint256,uint256,uint64,uint256,bool)" "$OFFER_ID" --rpc-url "$RPC" | sed -n '3p' | awk '{print $1}')
echo "offerId=$OFFER_ID cashToken=$CASH"
if [[ "${CASH,,}" != "${AUSDC,,}" ]]; then
  echo "FAIL: expected aUSDC"
  exit 1
fi
echo "PASS: DvP offer uses aUSDC"
