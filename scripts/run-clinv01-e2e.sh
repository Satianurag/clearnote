#!/usr/bin/env bash
# Full CLINV01 testnet lifecycle — invoice, Safe config, issueNote, add_rule, transfer demo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
CLINV="$ROOT/deployments/clinv01.json"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/wei-lt.sh"

REGISTRY=$(jq -r .registry "$DEPLOY")
CONTROLLER=$(jq -r .controller "$DEPLOY")
POLICY=$(jq -r '.policy // .policyV3' "$DEPLOY")
CLINV01=$(jq -r .address "$CLINV")
SAFE="0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593"

WALLET_A="0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB"
WALLET_B="0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b"
WALLET_B2="0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1"
UNITS=1000000000000000000

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_A_PRIVATE_KEY:?}"
: "${WALLET_B_PRIVATE_KEY:?}"
: "${WALLET_B2_PRIVATE_KEY:?}"

export MONAD_RPC="$RPC"
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"
chmod +x "$SAFE_EXEC"

echo "=== CLINV01 E2E ==="
echo "Registry:   $REGISTRY"
echo "Controller: $CONTROLLER"
echo "CLINV01:    $CLINV01"

# Fund B2 gas if low
B2_BAL=$(cast balance "$WALLET_B2" --rpc-url "$RPC")
if wei_lt "$B2_BAL" 500000000000000; then
  echo "Funding B2 with 0.2 MON..."
  cast send "$WALLET_B2" --value 0.2ether --rpc-url "$RPC" \
    --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
fi

INVOICE_ID=$(cast keccak "clearnote-clinv01-$(date +%s)")
DOC_HASH="$INVOICE_ID"
PINT_HASH=$(cast keccak "pint-clinv01-e2e")
FACE_VALUE=100000
DUE_DATE=$(($(date +%s) + 86400 * 30))
CURRENCY_HEX="0x534744"

echo "=== Register invoice $INVOICE_ID ==="
cast send "$REGISTRY" \
  "register((bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8))" \
  "($DOC_HASH,$PINT_HASH,$WALLET_A,$WALLET_A,$FACE_VALUE,$DUE_DATE,0,$CURRENCY_HEX,0)" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

DEADLINE=$(($(date +%s) + 3600))
export WALLET_A_PRIVATE_KEY
SIG=$(cd "$ROOT" && forge script contracts/script/SignAcceptance.s.sol \
  --rpc-url "$RPC" \
  --sig "run(address,bytes32,uint256,uint64,uint256)" \
  "$REGISTRY" "$INVOICE_ID" "$FACE_VALUE" "$DUE_DATE" "$DEADLINE" 2>&1 | \
  grep -oE '0x[0-9a-fA-F]{130}' | tail -1)

echo "=== Accept obligor ==="
cast send "$REGISTRY" "acceptByObligor(bytes32,uint256,bytes)" \
  "$INVOICE_ID" "$DEADLINE" "$SIG" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

echo "=== Safe: configure CLINV01 on Controller ==="
DATA1=$(cast calldata "setMaxInvestors(address,uint32)" "$CLINV01" 100)
DATA2=$(cast calldata "setMaxPositionBps(address,uint16)" "$CLINV01" 10000)
DATA3=$(cast calldata "setLockup(address,uint64)" "$CLINV01" 0)
TX1=$("$SAFE_EXEC" "$CONTROLLER" "$DATA1")
TX2=$("$SAFE_EXEC" "$CONTROLLER" "$DATA2")
TX3=$("$SAFE_EXEC" "$CONTROLLER" "$DATA3")
echo "setMaxInvestors: $TX1"
echo "setMaxPositionBps: $TX2"
echo "setLockup: $TX3"

echo "=== Safe: issueNote → wallet B ==="
DATA4=$(cast calldata "issueNote(bytes32,address,address,uint256)" \
  "$INVOICE_ID" "$CLINV01" "$WALLET_B" "$UNITS")
TX4=$("$SAFE_EXEC" "$CONTROLLER" "$DATA4")
echo "issueNote: $TX4"

BAL=$(cast call "$CLINV01" "balanceOf(address)(uint256)" "$WALLET_B" --rpc-url "$RPC")
echo "Wallet B CLINV01 balance: $BAL"

echo "=== add_rule (Cleanverse API) ==="
node "$ROOT/scripts/clinv01-add-rule.mjs" || true

echo "=== inspect B→B2 (should ok) ==="
cast call "$POLICY" \
  "inspect(address,address,address,uint256)(bool,bytes4,string)" \
  "$CLINV01" "$WALLET_B" "$WALLET_B2" "$UNITS" --rpc-url "$RPC"

echo "=== Live transfer B → B2 ==="
# fund B if needed
B_BAL=$(cast balance "$WALLET_B" --rpc-url "$RPC")
if wei_lt "$B_BAL" 500000000000000; then
  cast send "$WALLET_B" --value 0.3ether --rpc-url "$RPC" \
    --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
fi
TRANSFER_TX=$(cast send "$CLINV01" "transfer(address,uint256)" "$WALLET_B2" "$UNITS" \
  --rpc-url "$RPC" --private-key "$WALLET_B_PRIVATE_KEY" --json | jq -r .transactionHash)
echo "transfer B→B2: $TRANSFER_TX"

echo "=== DONE ==="
echo "invoiceId=$INVOICE_ID"
echo "issueNote=$TX4"
echo "transfer=$TRANSFER_TX"
