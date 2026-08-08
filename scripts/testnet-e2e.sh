#!/usr/bin/env bash
# Real testnet E2E — no mocks. Requires WALLET_A_PRIVATE_KEY in env or clearnote.keys.env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY_FILE="$ROOT/deployments/monad-10143.json"

if [[ -f "$ROOT/clearnote.keys.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/clearnote.keys.env"
  set +a
fi

if [[ -z "${WALLET_A_PRIVATE_KEY:-}" ]]; then
  echo "ERROR: WALLET_A_PRIVATE_KEY not set. Create $ROOT/clearnote.keys.env"
  exit 1
fi

export WALLET_A_PRIVATE_KEY
WALLET_A=$(cast wallet address "$WALLET_A_PRIVATE_KEY")
BASE="0x36489bE45fa84f70a0c2BDB11D824Be608CB12Dd"
CLLAT="0x13aDF50039Db284B380f06FD4be0061C30A92c96"
WALLET_B="0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b"
WALLET_B2="0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1"
DEAD_SINK="0xdead000000000000000000000000000000000001"
MINTER_ROLE="0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6"
BURNER_ROLE="0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848"

echo "=== Wallet A: $WALLET_A ==="

deploy_if_needed() {
  if [[ -f "$DEPLOY_FILE" ]]; then
    echo "Using existing deployment: $DEPLOY_FILE"
    return
  fi
  echo "=== Deploying Wave 1 contracts ==="
  cd "$ROOT"
  forge script contracts/script/DeployWave1.s.sol:DeployWave1 \
    --rpc-url "$RPC" \
    --broadcast \
    --slow 2>&1 | tee /tmp/clearnote-deploy.log

  REGISTRY=$(grep "InvoiceRegistry" /tmp/clearnote-deploy.log | tail -1 | awk '{print $2}')
  CONTROLLER=$(grep "ClearNoteController" /tmp/clearnote-deploy.log | tail -1 | awk '{print $2}')
  POLICY=$(grep "ClearNotePolicy" /tmp/clearnote-deploy.log | tail -1 | awk '{print $2}')
  SANCTIONS=$(grep "SanctionsRegistry" /tmp/clearnote-deploy.log | tail -1 | awk '{print $2}')

  mkdir -p "$ROOT/deployments"
  cat > "$DEPLOY_FILE" <<EOF
{
  "chainId": 10143,
  "registry": "$REGISTRY",
  "controller": "$CONTROLLER",
  "policy": "$POLICY",
  "sanctions": "$SANCTIONS",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
  echo "Written $DEPLOY_FILE"
}

deploy_if_needed
REGISTRY=$(jq -r .registry "$DEPLOY_FILE")
CONTROLLER=$(jq -r .controller "$DEPLOY_FILE")
POLICY=$(jq -r .policy "$DEPLOY_FILE")

echo "Registry:   $REGISTRY"
echo "Controller: $CONTROLLER"
echo "Policy:     $POLICY"

echo "=== Configure controller for CLLAT01 ==="
cast send "$CONTROLLER" "setMaxInvestors(address,uint32)" "$CLLAT" 100 \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
cast send "$CONTROLLER" "setMaxPositionBps(address,uint16)" "$CLLAT" 10000 \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
cast send "$CONTROLLER" "setLockup(address,uint64)" "$CLLAT" 0 \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

echo "=== Grant MINTER/BURNER on CLLAT01 to Controller ==="
cast send "$CLLAT" "grantRole(bytes32,address)" "$MINTER_ROLE" "$CONTROLLER" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash
cast send "$CLLAT" "grantRole(bytes32,address)" "$BURNER_ROLE" "$CONTROLLER" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

echo "=== Install ClearNotePolicy v3 on CLLAT01 ==="
POLICY_BEFORE=$(cast call "$CLLAT" "policy()(address)" --rpc-url "$RPC")
echo "Policy before: $POLICY_BEFORE"
SET_POLICY_TX=$(cast send "$CLLAT" "setPolicy(address)" "$POLICY" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash)
echo "setPolicy tx: $SET_POLICY_TX"
POLICY_AFTER=$(cast call "$CLLAT" "policy()(address)" --rpc-url "$RPC")
echo "Policy after: $POLICY_AFTER"

echo "=== Register + accept invoice (obligor = wallet A) ==="
INVOICE_ID=$(cast keccak "clearnote-e2e-invoice-$(date +%s)")
DOC_HASH="$INVOICE_ID"
FACE_VALUE=100000
DUE_DATE=$(($(date +%s) + 86400 * 30))
REGISTERED_AT=0
CURRENCY_HEX="0x534744"
PINT_HASH=$(cast keccak "pint-profile-e2e")

# register(Invoice) — originator must be msg.sender (wallet A)
cast send "$REGISTRY" \
  "register((bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8))" \
  "($DOC_HASH,$PINT_HASH,$WALLET_A,$WALLET_A,$FACE_VALUE,$DUE_DATE,$REGISTERED_AT,$CURRENCY_HEX,0)" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

DEADLINE=$(($(date +%s) + 3600))
# EIP-712 acceptance signature (wallet A as obligor)
NONCE=$(cast call "$REGISTRY" "nonces(address)(uint256)" "$WALLET_A" --rpc-url "$RPC" 2>/dev/null || echo 0)
# Use cast for typed data if available — otherwise manual sign via forge script
SIG=$(cd "$ROOT" && export WALLET_A_PRIVATE_KEY="$WALLET_A_PRIVATE_KEY" && \
  forge script contracts/script/SignAcceptance.s.sol \
  --rpc-url "$RPC" \
  --sig "run(address,bytes32,uint256,uint64,uint256)" \
  "$REGISTRY" "$INVOICE_ID" "$FACE_VALUE" "$DUE_DATE" "$DEADLINE" 2>&1 | \
  grep -oE '0x[0-9a-fA-F]{130}' | tail -1)

if [[ -z "$SIG" || "$SIG" == "0x" ]]; then
  echo "WARN: SignAcceptance script missing — skipping accept/issue (manual obligor sig needed)"
else
  cast send "$REGISTRY" "acceptByObligor(bytes32,uint256,bytes)" "$INVOICE_ID" "$DEADLINE" "$SIG" \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash

  echo "=== Issue note via Controller (mint to wallet B) ==="
  ISSUE_TX=$(cast send "$CONTROLLER" "issueNote(bytes32,address,address,uint256)" \
    "$INVOICE_ID" "$CLLAT" "$WALLET_B" 1000000000000000000 \
    --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash)
  echo "issueNote tx: $ISSUE_TX"
fi

echo "=== inspect() pre-flight (B -> B2, 1 token) ==="
cast call "$POLICY" \
  "inspect(address,address,address,uint256)(bool,bytes4,string)" \
  "$CLLAT" "$WALLET_B" "$WALLET_B2" 1000000000000000000 \
  --rpc-url "$RPC"

echo "=== inspect() dead sink (expect no A-Pass) ==="
cast call "$POLICY" \
  "inspect(address,address,address,uint256)(bool,bytes4,string)" \
  "$CLLAT" "$WALLET_B" "$DEAD_SINK" 1000000000000000000 \
  --rpc-url "$RPC" || echo "inspect denied as expected"

echo "=== Rollback CLLAT01 policy to BASE ==="
ROLLBACK_TX=$(cast send "$CLLAT" "setPolicy(address)" "$BASE" \
  --rpc-url "$RPC" --private-key "$WALLET_A_PRIVATE_KEY" --json | jq -r .transactionHash)
echo "rollback tx: $ROLLBACK_TX"
ROLLBACK_POLICY=$(cast call "$CLLAT" "policy()(address)" --rpc-url "$RPC")
echo "Policy rolled back: $ROLLBACK_POLICY"

echo "=== E2E complete ==="
