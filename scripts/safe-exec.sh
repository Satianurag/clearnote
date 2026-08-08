#!/usr/bin/env bash
# Execute one Gnosis Safe 1.4.x transaction with 2-of-3 signatures (A + B2).
# Usage: safe-exec.sh <target> <calldata_hex>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
SAFE="0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593"
ZERO="0x0000000000000000000000000000000000000000"

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi

: "${WALLET_A_PRIVATE_KEY:?WALLET_A_PRIVATE_KEY missing}"
: "${WALLET_B2_PRIVATE_KEY:?WALLET_B2_PRIVATE_KEY missing}"

TO="${1:?target}"
DATA="${2:?calldata}"

sign_safe_owner() {
  local pk="$1"
  local tx_hash="$2"
  cast wallet sign --private-key "$pk" "$tx_hash" --no-hash
}

NONCE=$(cast call "$SAFE" "nonce()(uint256)" --rpc-url "$RPC")
TX_HASH=$(cast call "$SAFE" \
  "getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256)(bytes32)" \
  "$TO" 0 "$DATA" 0 0 0 0 "$ZERO" "$ZERO" "$NONCE" \
  --rpc-url "$RPC")

SIG_A=$(sign_safe_owner "$WALLET_A_PRIVATE_KEY" "$TX_HASH")
SIG_B2=$(sign_safe_owner "$WALLET_B2_PRIVATE_KEY" "$TX_HASH")

# Owners sorted by address: A (0x20a2...) then B2 (0xb77D...)
COMBINED="${SIG_A}${SIG_B2#0x}"

echo "Safe exec → $TO nonce=$NONCE txHash=$TX_HASH" >&2
GAS_LIMIT=$(cast estimate "$SAFE" \
  "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)" \
  "$TO" 0 "$DATA" 0 0 0 0 "$ZERO" "$ZERO" "$COMBINED" \
  --rpc-url "$RPC" 2>/dev/null || echo 250000)
GAS_LIMIT=$((GAS_LIMIT * 120 / 100 + 10000))

cast send "$SAFE" \
  "execTransaction(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,bytes)" \
  "$TO" 0 "$DATA" 0 0 0 0 "$ZERO" "$ZERO" "$COMBINED" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --gas-limit "$GAS_LIMIT" --json | jq -r .transactionHash
