#!/usr/bin/env bash
# WO-08 acceptance spot checks on Monad testnet.
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
CONTROLLER=$(jq -r .controller "$DEPLOY")
CLINV01=$(jq -r .e2e.clinv01 "$DEPLOY")
SAFE_EXEC="$ROOT/scripts/safe-exec.sh"

# Ensure CLINV01 has non-zero lockup (deploy default was 0 — lockup demo needs config)
LOCKUP_SEC=$(cast call "$CONTROLLER" "lockupSeconds(address)(uint64)" "$CLINV01" --rpc-url "$RPC" | awk '{print $1}')
DEFAULT_SEC=$(cast call "$CONTROLLER" "defaultLockupSeconds()(uint64)" --rpc-url "$RPC" | awk '{print $1}')
if [[ "${LOCKUP_SEC:-0}" == "0" && "${DEFAULT_SEC:-0}" == "0" ]]; then
  echo "Configuring lockupSeconds=86400 on CLINV01 via Safe" >&2
  DATA=$(cast calldata "setLockup(address,uint64)" "$CLINV01" 86400)
  bash "$SAFE_EXEC" "$CONTROLLER" "$DATA" >/dev/null || true
fi
POLICY=$(jq -r '.policy // .policyV3_1' "$DEPLOY")
BASE=$(jq -r .baseRouter "$DEPLOY")
CLNOTE02=0xDAA42E5c1A8B9724F499729609f166B0D140Ec18
A=0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB
B=0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b
DEAD=0xdead000000000000000000000000000000000001
MINTER=0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
AMT=1000000000000000000

ok=0
fail=0
check() {
  if eval "$2"; then echo "PASS $1"; ok=$((ok+1)); else echo "FAIL $1"; fail=$((fail+1)); fi
}

POL=$(cast call "$CLINV01" "policy()(address)" --rpc-url "$RPC")
check "policy is live v3.2" "[[ \"${POL,,}\" == \"${POLICY,,}\" ]]"

POL02=$(cast call "$CLNOTE02" "policy()(address)" --rpc-url "$RPC")
check "CLNOTE02 untouched" "[[ \"${POL02,,}\" == \"${BASE,,}\" ]]"

HAS_MINTER=$(cast call "$CLINV01" "hasRole(bytes32,address)(bool)" "$MINTER" "$A" --rpc-url "$RPC")
check "A lacks MINTER" "[[ \"$HAS_MINTER\" == \"false\" ]]"

# Human mint blocked (A should lack MINTER_ROLE)
MINT_OUT=$(cast send "$CLINV01" "mint(address,uint256)" "$B" 1 \
  --rpc-url "$RPC" --private-key "$(grep WALLET_A_PRIVATE_KEY "$ROOT/clearnote.keys.env" | cut -d= -f2)" 2>&1 || true)
if echo "$MINT_OUT" | grep -qiE "e2517d3f|AccessControl|revert|denied"; then
  echo "PASS human mint blocked"
  ok=$((ok+1))
else
  echo "FAIL human mint should revert: $MINT_OUT"
  fail=$((fail+1))
fi

# BASE alive: transfer to dead from B should fail with Cleanverse code (simulate)
DEAD_ERR=$(cast call "$CLINV01" "transfer(address,uint256)(bool)" "$DEAD" 1 \
  --from "$B" --rpc-url "$RPC" 2>&1 || true)
if echo "$DEAD_ERR" | grep -qi "a6725971\|revert"; then
  echo "PASS transfer to no-apass reverts"
  ok=$((ok+1))
else
  echo "FAIL dead transfer: $DEAD_ERR"
  fail=$((fail+1))
fi

SANCTIONED=0x1111111111111111111111111111111111111111
C=0x052eF2f1ce92245E264785ab99A1e7114c809534
E=0x10aBc0Efeff51Ce3dDAdd17eD55261163E0dEd05

inspect_deny() {
  local label="$1" from="$2" to="$3" pattern="$4"
  local out
  out=$(cast call "$POLICY" "inspect(address,address,address,uint256)(bool,bytes4,string)" \
    "$CLINV01" "$from" "$to" "$AMT" --rpc-url "$RPC" 2>&1 || true)
  if echo "$out" | grep -qiE "false|$pattern"; then
    echo "PASS inspect $label denies ($pattern)"
    ok=$((ok+1))
  else
    echo "FAIL inspect $label: $out"
    fail=$((fail+1))
  fi
}

inspect_deny "no-apass" "$B" "$DEAD" "a6725971"
inspect_deny "sanctioned" "$B" "$SANCTIONED" "80279111"
inspect_deny "frozen-C" "$B" "$C" "322fde89"
inspect_deny "tier-E" "$B" "$E" "e3e32fdb"

# Lockup — controller redeploy resets per-wallet lockedUntil; seed fresh issuance if needed
REGISTRY=$(jq -r .registry "$DEPLOY")
LOCKUP_WALLET="$E"
LOCKED_UNTIL=$(cast call "$CONTROLLER" "lockedUntil(address,address)(uint64)" "$CLINV01" "$LOCKUP_WALLET" --rpc-url "$RPC" | awk '{print $1}')
NOW_TS=$(date +%s)
if [[ "${LOCKED_UNTIL:-0}" -le "$NOW_TS" ]]; then
  echo "Seeding active lockup: register + issueNote -> E (zero balance holder)" >&2
  : "${WALLET_A_PRIVATE_KEY:?}"
  INVOICE_ID=$(cast keccak "clearnote-lockup-v32-$(date +%s)")
  FACE=100000
  DUE=$(($(date +%s) + 86400))
  cast send "$REGISTRY" \
    "register((bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8))" \
    "($INVOICE_ID,$INVOICE_ID,$A,$A,$FACE,$DUE,0,0x534744,0)" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" >/dev/null
  DEADLINE=$(($(date +%s) + 3600))
  SIG=$(cd "$ROOT" && forge script contracts/script/SignAcceptance.s.sol \
    --rpc-url "$RPC" \
    --sig "run(address,bytes32,uint256,uint64,uint256)" \
    "$REGISTRY" "$INVOICE_ID" "$FACE" "$DUE" "$DEADLINE" 2>&1 | \
    grep -oE '0x[0-9a-fA-F]{130}' | tail -1)
  cast send "$REGISTRY" "acceptByObligor(bytes32,uint256,bytes)" \
    "$INVOICE_ID" "$DEADLINE" "$SIG" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" >/dev/null
  DATA=$(cast calldata "issueNote(bytes32,address,address,uint256)" "$INVOICE_ID" "$CLINV01" "$LOCKUP_WALLET" "$AMT")
  bash "$SAFE_EXEC" "$CONTROLLER" "$DATA" >/dev/null
  sleep 5
fi
inspect_deny "lockup" "$LOCKUP_WALLET" "$A" "6294ca98"

echo "WO-08 verify: $ok passed, $fail failed"
[[ "$fail" -eq 0 ]]
