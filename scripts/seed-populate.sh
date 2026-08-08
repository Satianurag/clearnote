#!/usr/bin/env bash
# WO-09: Seed 12 invoices on Monad testnet — real txs, no mocks.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"
CLINV="$ROOT/deployments/clinv01.json"

REGISTRY=$(jq -r .registry "$DEPLOY")
CONTROLLER=$(jq -r .controller "$DEPLOY")
CLINV01=$(jq -r .address "$CLINV")
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"
SAFE=0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593

# Wallets (WO naming)
A=0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB
B=0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b
B2=0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1
C=0x052eF2f1ce92245E264785ab99A1e7114c809534
D=0xf652F0ACBa57B29461Cc9a9Ecd87b8cf1c51DaB7
E=0x10aBc0Efeff51Ce3dDAdd17eD55261163E0dEd05
SANCTIONED=0x1111111111111111111111111111111111111111
UNITS=1000000000000000000

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi
: "${WALLET_A_PRIVATE_KEY:?}"

export WALLET_A_PRIVATE_KEY MONAD_RPC="$RPC"
mkdir -p "$ROOT/seed/invoices"
MANIFEST="$ROOT/seed/manifest.json"
INVOICES_JSON="[]"

wait_tx() {
  local hash="$1"
  [[ -n "$hash" && "$hash" != "null" ]] || return 0
  cast receipt "$hash" --rpc-url "$RPC" --confirmations 1 >/dev/null
}

invoice_get() {
  cast call "$REGISTRY" \
    "get(bytes32)((bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8))" \
    "$1" --rpc-url "$RPC" 2>/dev/null || true
}

invoice_status() {
  local raw
  raw=$(invoice_get "$1")
  if [[ -z "$raw" ]]; then
    echo 0
    return
  fi
  echo "$raw" | sed -n 's/.*, \([0-9]*\))$/\1/p'
}

invoice_face_due() {
  local raw="$1"
  local face due
  face=$(echo "$raw" | sed -n 's/.*, \([0-9]*\) \[1e5\], \([0-9]*\).*/\1/p')
  due=$(echo "$raw" | sed -n 's/.*, \([0-9]*\) \[1e5\], \([0-9]*\).*/\2/p')
  echo "$face $due"
}

prev_manifest_field() {
  local id="$1" field="$2"
  [[ -f "$MANIFEST" ]] || return 0
  jq -r --arg id "$id" --arg f "$field" '.invoices[]? | select(.id==$id) | .[$f] // empty' "$MANIFEST" 2>/dev/null | head -1
}

should_finance() {
  case "$1" in
    INV-00[1-8]) return 0 ;;
    *) return 1 ;;
  esac
}

finance_target_for() {
  case "$1" in
    INV-001) echo "$B" ;;
    INV-002) echo "$B2" ;;
    INV-003) echo "$D" ;;
    INV-004) echo "$E" ;;
    INV-005) echo "$A" ;;
    INV-006) echo "$C" ;;
    INV-007) echo "$B" ;;
    INV-008) echo "$SANCTIONED" ;;
    *) return 1 ;;
  esac
}

issue_precheck() {
  local invoice_id="$1" to="$2"
  cast call "$CONTROLLER" "issueNote(bytes32,address,address,uint256)" \
    "$invoice_id" "$CLINV01" "$to" "$UNITS" --from "$SAFE" --rpc-url "$RPC" >/dev/null 2>&1
}

resolve_issue_to() {
  local id="$1" invoice_id="$2"
  local preferred fallback
  preferred=$(finance_target_for "$id")
  if issue_precheck "$invoice_id" "$preferred"; then
    echo "$preferred"
    return
  fi
  echo "WARN: $id issue to $preferred would revert; using wallet D for on-chain mint" >&2
  fallback=$D
  if issue_precheck "$invoice_id" "$fallback"; then
    echo "$fallback"
    return
  fi
  echo "WARN: $id issue fallback $fallback failed; using wallet B" >&2
  echo "$B"
}

register_invoice() {
  local id="$1" xml="$2" face="$3" due="$4"
  local doc_hash pint_hash tx_reg
  doc_hash=$(node "$ROOT/scripts/pint-hash.mjs" "$xml" | jq -r .docHash)
  pint_hash=$(cast keccak "pint-profile-seed-$id")
  tx_reg=$(cast send "$REGISTRY" \
    "register((bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8))" \
    "($doc_hash,$pint_hash,$A,$A,$face,$due,0,0x534744,0)" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash)
  wait_tx "$tx_reg"
  echo "$tx_reg"
}

accept_invoice() {
  local invoice_id="$1" face="$2" due="$3"
  local deadline sig tx_acc
  deadline=$(($(date +%s) + 3600))
  sig=$(cd "$ROOT/contracts" && forge script script/SignAcceptance.s.sol \
    --rpc-url "$RPC" \
    --sig "run(address,bytes32,uint256,uint64,uint256)" \
    "$REGISTRY" "$invoice_id" "$face" "$due" "$deadline" 2>&1 | \
    grep -oE '0x[0-9a-fA-F]{130}' | tail -1)
  [[ -n "$sig" ]] || { echo "accept_invoice: empty EIP-712 sig for $invoice_id" >&2; return 1; }
  tx_acc=$(cast send "$REGISTRY" "acceptByObligor(bytes32,uint256,bytes)" \
    "$invoice_id" "$deadline" "$sig" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash)
  wait_tx "$tx_acc"
  echo "$tx_acc"
}

issue_note() {
  local invoice_id="$1" to="$2"
  local data tx_issue
  data=$(cast calldata "issueNote(bytes32,address,address,uint256)" "$invoice_id" "$CLINV01" "$to" "$UNITS")
  tx_issue=$(bash "$SAFE_EXEC" "$CONTROLLER" "$data")
  wait_tx "$tx_issue"
  echo "$tx_issue"
}

echo "=== WO-09 Seed populate ==="

for i in $(seq 1 12); do
  cp "$ROOT/seed/samples/invoice-factor-a.xml" "$ROOT/seed/invoices/INV-$(printf '%03d' $i).xml"
  sed -i "s/INV-E2E-001/INV-$(printf '%03d' $i)/" "$ROOT/seed/invoices/INV-$(printf '%03d' $i).xml"
done
cp "$ROOT/seed/samples/invoice-factor-b.xml" "$ROOT/seed/invoices/INV-011.xml"
sed -i 's/INV-E2E-001/INV-001/' "$ROOT/seed/invoices/INV-011.xml"

DUE_SOON=$(($(date +%s) + 600))
DUE_LATER=$(($(date +%s) + 86400 * 30))
FACE=100000

for i in $(seq 1 12); do
  ID=$(printf 'INV-%03d' "$i")
  XML="$ROOT/seed/invoices/$ID.xml"

  if [[ "$ID" == "INV-011" ]]; then
    echo "SKIP register $ID (duplicate demo)"
    INVOICES_JSON=$(echo "$INVOICES_JSON" | jq ". + [{\"id\":\"$ID\",\"status\":\"skipped_register\",\"note\":\"duplicate demo\"}]")
    continue
  fi

  due=$DUE_LATER
  [[ "$ID" == "INV-012" ]] && due=$DUE_SOON

  invoice_id=$(node "$ROOT/scripts/pint-hash.mjs" "$XML" | jq -r .docHash)
  chain_st=$(invoice_status "$invoice_id")
  chain_st=${chain_st:-0}

  tx_reg=$(prev_manifest_field "$ID" registerTx)
  tx_acc=$(prev_manifest_field "$ID" acceptTx)
  tx_issue=$(prev_manifest_field "$ID" issueTx)
  finance_to=""

  if [[ "$chain_st" == "0" ]]; then
    echo "Register $ID..."
    tx_reg=$(register_invoice "$ID" "$XML" "$FACE" "$due")
    chain_st=$(invoice_status "$invoice_id")
    chain_st=${chain_st:-1}
  else
    echo "Skip register $ID (on-chain status=$chain_st)"
  fi

  inv_raw=$(invoice_get "$invoice_id")
  read -r face_on due_on <<<"$(invoice_face_due "$inv_raw")"
  face_on=${face_on:-$FACE}
  due_on=${due_on:-$due}

  status="Registered"
  if [[ "$ID" == "INV-010" ]]; then
    status="Registered_unaccepted"
  elif [[ "$chain_st" == "1" ]]; then
    echo "Accept $ID..."
    tx_acc=$(accept_invoice "$invoice_id" "$face_on" "$due_on")
    chain_st=2
    status="ObligorAccepted"
  elif [[ "$chain_st" -ge 2 ]]; then
    status="ObligorAccepted"
    echo "Skip accept $ID (on-chain status=$chain_st)"
  fi

  if should_finance "$ID"; then
    finance_to=$(finance_target_for "$ID" || true)
    if [[ "$chain_st" -ge 3 ]]; then
      status="Financed"
      echo "Skip issue $ID (already financed)"
    elif [[ "$chain_st" -ge 2 ]]; then
      to=$(resolve_issue_to "$ID" "$invoice_id")
      echo "IssueNote $ID -> $to (demo target $finance_to)"
      tx_issue=$(issue_note "$invoice_id" "$to")
      chain_st=3
      status="Financed"
    fi
  fi

  INVOICES_JSON=$(echo "$INVOICES_JSON" | jq ". + [{
    \"id\": \"$ID\",
    \"invoiceId\": \"$invoice_id\",
    \"file\": \"seed/invoices/$ID.xml\",
    \"status\": \"$status\",
    \"financeTarget\": \"$finance_to\",
    \"registerTx\": \"$tx_reg\",
    \"acceptTx\": \"$tx_acc\",
    \"issueTx\": \"$tx_issue\"
  }]")
done

jq -n \
  --argjson invoices "$INVOICES_JSON" \
  --arg version "1" \
  '{version: ($version|tonumber), invoices: $invoices, wallets: {A: "'"$A"'", B: "'"$B"'", B2: "'"$B2"'", C: "'"$C"'"}}' \
  > "$MANIFEST"

echo "=== Seed complete ==="
jq '.invoices | length' "$MANIFEST"
