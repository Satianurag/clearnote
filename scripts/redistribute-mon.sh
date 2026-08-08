#!/usr/bin/env bash
# Redistribute testnet MON across demo wallets for live testing (WO naming).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"

A=0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB
B=0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b
B2=0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1
C=0x052eF2f1ce92245E264785ab99A1e7114c809534

# Target balances for demos (wei)
TARGET_A=2000000000000000000   # 2 MON — issuer + Safe relayer
TARGET_B=500000000000000000    # 0.5 MON — MetaMask hero investor
TARGET_B2=150000000000000000   # 0.15 MON — Safe co-signer
TARGET_C=100000000000000000    # 0.1 MON — frozen wallet gas

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi

bal() {
  cast balance "$1" --rpc-url "$RPC"
}

send_from() {
  local pk="$1" from_label="$2" to="$3" want="$4"
  local cur want_wei diff
  cur=$(bal "$to")
  want_wei=$want
  if [[ "$cur" -ge "$want_wei" ]]; then
    echo "OK $to already has $(cast --to-unit "$cur" ether) MON (target $(cast --to-unit "$want_wei" ether))"
    return 0
  fi
  diff=$((want_wei - cur))
  # leave 0.02 MON gas headroom on sender
  local from_bal
  from_bal=$(bal "$(cast wallet address --private-key "$pk")")
  local max_send=$((from_bal - 20000000000000000))
  if [[ "$max_send" -lt "$diff" ]]; then
    diff=$max_send
  fi
  if [[ "$diff" -le 0 ]]; then
    echo "SKIP $from_label → $to (sender broke or target met)"
    return 0
  fi
  echo "Send $(cast --to-unit "$diff" ether) MON $from_label → $to"
  cast send "$to" --value "$diff" --rpc-url "$RPC" --private-key "$pk" --json | jq -r .transactionHash
}

echo "=== Balances before ==="
for w in A B B2 C; do
  addr=$(eval echo \$$w)
  echo "$w $(cast --to-unit "$(bal "$addr")" ether) MON"
done

# Fund B, B2, C from richest keyed wallet
declare -A PK=()
: "${WALLET_A_PRIVATE_KEY:?}"
PK[A]=$WALLET_A_PRIVATE_KEY
[[ -n "${WALLET_B_PRIVATE_KEY:-}" ]] && PK[B]=$WALLET_B_PRIVATE_KEY
[[ -n "${WALLET_B2_PRIVATE_KEY:-}" ]] && PK[B2]=$WALLET_B2_PRIVATE_KEY
[[ -n "${WALLET_C_PRIVATE_KEY:-}" ]] && PK[C]=$WALLET_C_PRIVATE_KEY

pick_donor() {
  local need="${1:-0}"
  local best_label="" best_bal=0
  for label in A B B2 C; do
    [[ -n "${PK[$label]:-}" ]] || continue
    local addr bal_wei
    addr=$(eval echo \$$label)
    bal_wei=$(bal "$addr")
    if [[ "$bal_wei" -gt "$best_bal" ]]; then
      best_bal=$bal_wei
      best_label=$label
    fi
  done
  if [[ -z "$best_label" ]]; then
    echo "ERROR no donor wallet" >&2
    return 1
  fi
  echo "$best_label"
}

for pair in "B:$TARGET_B" "B2:$TARGET_B2" "C:$TARGET_C"; do
  label=${pair%%:*}
  target=${pair##*:}
  addr=$(eval echo \$$label)
  cur=$(bal "$addr")
  if [[ "$cur" -ge "$target" ]]; then continue; fi
  donor=$(pick_donor)
  send_from "${PK[$donor]}" "$donor" "$addr" "$target"
done

# Trim A to target if excessive (send surplus to B)
a_bal=$(bal "$A")
if [[ "$a_bal" -gt $((TARGET_A + 500000000000000000)) ]] && [[ -n "${WALLET_A_PRIVATE_KEY:-}" ]]; then
  surplus=$((a_bal - TARGET_A))
  send_from "$WALLET_A_PRIVATE_KEY" A "$B" "$(($(bal "$B") + surplus - 10000000000000000))"
fi

echo "=== Balances after ==="
for w in A B B2 C; do
  addr=$(eval echo \$$w)
  echo "$w $(cast --to-unit "$(bal "$addr")" ether) MON"
done
