#!/usr/bin/env bash
# Fill DvP offer on testnet — buyer = B, cash leg = aUSDC (default 1 unit / 1 aUSDC).
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
: "${WALLET_B_PRIVATE_KEY:?}"

OFFER_ID="${1:-0}"
UNITS="${2:-1000000000000000000}"
CASH_NEEDED="${3:-1000000}"

AUSDC=0xaC0893567D43C3E7e6e35a72803df05416C1f20D
DVP=$(jq -r .dvpEscrow "$DEPLOY")

echo "=== Approve $CASH_NEEDED aUSDC units for DvPEscrow ==="
cast send "$AUSDC" "approve(address,uint256)" "$DVP" "$CASH_NEEDED" \
  --rpc-url "$RPC" --private-key "$WALLET_B_PRIVATE_KEY" --json | jq -r .transactionHash

echo "=== fill(offerId=$OFFER_ID, units=$UNITS) ==="
TX=$(cast send "$DVP" "fill(uint256,uint256)" "$OFFER_ID" "$UNITS" \
  --rpc-url "$RPC" --private-key "$WALLET_B_PRIVATE_KEY" --json | jq -r .transactionHash)
echo "tx: $TX"
echo "https://testnet.monadscan.com/tx/$TX"

REMAINING=$(cast call "$DVP" "offers(uint256)(address,address,address,uint256,uint256,uint64,uint256,bool)" "$OFFER_ID" --rpc-url "$RPC" | sed -n '7p' | awk '{print $1}')
ACTIVE=$(cast call "$DVP" "offers(uint256)(address,address,address,uint256,uint256,uint64,uint256,bool)" "$OFFER_ID" --rpc-url "$RPC" | sed -n '8p' | awk '{print $1}')
echo "offerId=$OFFER_ID remaining=$REMAINING active=$ACTIVE"
echo "PASS: DvP fill submitted"
