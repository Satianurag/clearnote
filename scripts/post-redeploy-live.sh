#!/usr/bin/env bash
# Post-redeploy live proof: inspect + transfer on v3.2 policy, fresh issueNote on new controller.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/wei-lt.sh"

REGISTRY=$(jq -r .registry "$DEPLOY")
CONTROLLER=$(jq -r .controller "$DEPLOY")
POLICY=$(jq -r .policy "$DEPLOY")
CLINV01=$(jq -r .e2e.clinv01 "$DEPLOY")
A=0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB
B=0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b
B2=0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1
UNITS=1000000000000000000
MINTER_ROLE=0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
SAFE=0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_A_PRIVATE_KEY:?}"
: "${WALLET_B_PRIVATE_KEY:?}"

echo "=== inspect CLINV01 B→B2 (v3.2 policy) ==="
INSPECT_RAW=$(cast call "$POLICY" \
  "inspect(address,address,address,uint256)(bool,bytes4,string)" \
  "$CLINV01" "$B" "$B2" "$UNITS" --rpc-url "$RPC")
echo "$INSPECT_RAW"
INSPECT_SUMMARY=$(echo "$INSPECT_RAW" | awk '
  NR==1 { ok=$1 }
  NR==2 { code=$1 }
  NR==3 { gsub(/"/, "", $0); reason=$0 }
  END { printf "ok:%s code:%s reason:%s", ok, code, reason }
')

B_BAL=$(cast balance "$B" --rpc-url "$RPC")
if wei_lt "$B_BAL" 500000000000000; then
  echo "Funding B gas..."
  cast send "$B" --value 0.2ether --rpc-url "$RPC" \
    --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
fi

echo "=== live transfer B→B2 (v3.2) ==="
TRANSFER_TX=$(cast send "$CLINV01" "transfer(address,uint256)" "$B2" "$UNITS" \
  --rpc-url "$RPC" --private-key "$WALLET_B_PRIVATE_KEY" --json | jq -r .transactionHash)
echo "transfer: $TRANSFER_TX"

echo "=== fresh invoice on new controller (issueNote → Safe, zero balance) ==="
HAS_MINTER=$(cast call "$CLINV01" "hasRole(bytes32,address)(bool)" "$MINTER_ROLE" "$CONTROLLER" --rpc-url "$RPC" 2>/dev/null || echo false)
if [[ "$HAS_MINTER" != "true" ]]; then
  echo "Granting MINTER_ROLE on CLINV01 to new controller..."
  cast send "$CLINV01" "grantRole(bytes32,address)" "$MINTER_ROLE" "$CONTROLLER" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" >/dev/null
fi
INVOICE_ID=$(cast keccak "clearnote-inv-013-v32-$(date +%s)")
FACE=100000
DUE=$(($(date +%s) + 86400 * 30))
cast send "$REGISTRY" \
  "register((bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8))" \
  "($INVOICE_ID,$INVOICE_ID,$A,$A,$FACE,$DUE,0,0x534744,0)" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

DEADLINE=$(($(date +%s) + 3600))
SIG=$(cd "$ROOT" && forge script contracts/script/SignAcceptance.s.sol \
  --rpc-url "$RPC" \
  --sig "run(address,bytes32,uint256,uint64,uint256)" \
  "$REGISTRY" "$INVOICE_ID" "$FACE" "$DUE" "$DEADLINE" 2>&1 | \
  grep -oE '0x[0-9a-fA-F]{130}' | tail -1)
cast send "$REGISTRY" "acceptByObligor(bytes32,uint256,bytes)" \
  "$INVOICE_ID" "$DEADLINE" "$SIG" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

DATA=$(cast calldata "issueNote(bytes32,address,address,uint256)" "$INVOICE_ID" "$CLINV01" "$SAFE" "$UNITS")
ISSUE_TX=$(bash "$SAFE_EXEC" "$CONTROLLER" "$DATA")
echo "issueNote → Safe: $ISSUE_TX"

COUNT=$(cast call "$CONTROLLER" "investorCount(address)(uint256)" "$CLINV01" --rpc-url "$RPC" | awk '{print $1}')
echo "controller investorCount[CLINV01]=$COUNT"

jq \
  --arg t "$TRANSFER_TX" \
  --arg i "$ISSUE_TX" \
  --arg inv "$INVOICE_ID" \
  --arg insp "$INSPECT_SUMMARY" \
  '.e2e.clinv01TransferBtoB2_v32 = $t
   | .e2e.clinv01InspectBtoB2_v32 = $insp
   | .e2e.controllerIssueNote_v32 = $i
   | .e2e.controllerIssueInvoiceId_v32 = $inv' \
  "$DEPLOY" > "${DEPLOY}.tmp" && mv "${DEPLOY}.tmp" "$DEPLOY"

echo "=== DONE ==="
echo "clinv01InspectBtoB2_v32=$INSPECT_SUMMARY"
echo "clinv01TransferBtoB2_v32=$TRANSFER_TX"
echo "controllerIssueNote_v32=$ISSUE_TX"
echo "invoiceId=$INVOICE_ID"
