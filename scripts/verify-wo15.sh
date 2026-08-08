#!/usr/bin/env bash
# WO-15 · Truth pass — no overclaims before submission
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
RPC="${MONAD_RPC:-https://testnet-rpc.monad.xyz}"
DEPLOY="$ROOT/deployments/monad-10143.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "=== WO-15 truth pass ==="

[[ -f docs/CLAIMS.md ]] && pass "docs/CLAIMS.md exists"

# services ↔ app reasonCodes mirror (compare selector keys + labels)
SVC_KEYS=$(grep -oE '"0x[0-9a-f]{8}"' services/src/reasonCodes.ts | sort)
APP_KEYS=$(grep -oE '"0x[0-9a-f]{8}"' app/lib/reasonCodes.ts | sort)
if [[ "$SVC_KEYS" == "$APP_KEYS" ]]; then
  pass "reasonCodes.ts selectors match between services and app"
else
  diff -u <(echo "$SVC_KEYS") <(echo "$APP_KEYS") || fail "reasonCodes selector mismatch"
fi

SVC_COUNT=$(echo "$SVC_KEYS" | wc -l)
README_COUNT=$(grep -cE '`0x[0-9a-f]{8}`' README.md || true)
if [[ "$SVC_COUNT" -eq 13 && "$README_COUNT" -eq 13 ]]; then
  pass "13 live reason codes in services + README table"
else
  fail "reason code count: services=$SVC_COUNT README=$README_COUNT (expected 13)"
fi

# cast sig ↔ reasonCodes.ts
declare -A EXPECTED_SIGS=(
  ["PositionCapExceeded(address,uint256,uint256)"]="0x1513ddcb"
  ["LockupActive(address,address,uint64)"]="0x6294ca98"
  ["InvestorLimitReached(address,uint256,uint256)"]="0x0505a996"
  ["TransfersPaused(address)"]="0x90e3871c"
  ["NoteNotBacked(address)"]="0x0185f166"
  ["PolicyNotConfigured()"]="0x3f70126b"
  ["TierTooLow(address,uint256,uint256)"]="0xe3e32fdb"
  ["SanctionedAddress(address)"]="0x80279111"
  ["ApassLookupFailed(address)"]="0xba7cb6e7"
)
for sig in "${!EXPECTED_SIGS[@]}"; do
  got=$(cast sig "$sig" | awk '{print $1}')
  want="${EXPECTED_SIGS[$sig]}"
  if [[ "${got,,}" == "${want,,}" ]] && grep -qi "${want}" services/src/reasonCodes.ts; then
    pass "cast sig $want ↔ $sig"
  else
    fail "selector mismatch $sig: cast=$got want=$want"
  fi
done

# Banned overclaim phrases in submission-facing docs (exclude internal book + "do not claim" lists)
BANNED_HITS=$(git grep -iE 'gasless onboarding|tier enforced by Cleanverse|blacklist enforced by Cleanverse' \
  -- README.md docs/ARCHITECTURE.md docs/SECURITY.md app/ indexer/README.md 2>/dev/null \
  | grep -viE 'No gasless|not claim|documented next step' || true)
if [[ -z "$BANNED_HITS" ]]; then
  pass "no banned overclaim phrases in submission paths"
else
  echo "$BANNED_HITS"
  fail "banned overclaim phrase found"
fi

# Full addresses in README deployment table (no ellipsis in hex)
if grep -E '0x[0-9a-fA-F]{4,}…|0x[0-9a-fA-F]{4,}\.\.\.' README.md 2>/dev/null; then
  fail "truncated hex in README.md"
fi
pass "README deployment addresses not truncated"

BASE=$(jq -r .baseRouter "$DEPLOY")
POLICY=$(jq -r '.policy // .policyV3_1' "$DEPLOY")
CLNOTE02=0xDAA42E5c1A8B9724F499729609f166B0D140Ec18
CLLAT01=$(jq -r .cllat01 "$DEPLOY")
CLINV01=$(jq -r .e2e.clinv01 "$DEPLOY")

POL02=$(cast call "$CLNOTE02" "policy()(address)" --rpc-url "$RPC")
if [[ "${POL02,,}" == "${BASE,,}" ]]; then
  pass "CLNOTE02 policy() is BASE router"
else
  fail "CLNOTE02 policy=$POL02 expected BASE=$BASE"
fi

POL_LAT=$(cast call "$CLLAT01" "policy()(address)" --rpc-url "$RPC")
if [[ "${POL_LAT,,}" == "${BASE,,}" ]]; then
  pass "CLLAT01 rolled back to BASE"
else
  fail "CLLAT01 policy=$POL_LAT expected BASE=$BASE"
fi

POL_INV=$(cast call "$CLINV01" "policy()(address)" --rpc-url "$RPC")
if [[ "${POL_INV,,}" == "${POLICY,,}" ]]; then
  pass "CLINV01 policy() is live v3.2"
else
  fail "CLINV01 policy=$POL_INV expected $POLICY"
fi

# Post-redeploy proof keys in deployments JSON
for key in clinv01TransferBtoB2_v32 clinv01InspectBtoB2_v32 controllerIssueNote_v32; do
  val=$(jq -r ".e2e.$key // empty" "$DEPLOY")
  if [[ -n "$val" && "$val" != "null" ]]; then
    pass "e2e.$key recorded"
  else
    fail "missing e2e.$key in deployments JSON"
  fi
done

# Secret scan — working tree + history
if git grep -iE '(PRIVATE_KEY|privateKey)\s*=\s*0x[a-fA-F0-9]{64}' \
  -- ':!*.keys.env.example' ':!clearnote.keys.env.example' ':!docs/' ':!contracts/lib/' 2>/dev/null; then
  fail "private key literals in tracked files"
fi
pass "no private keys in tracked working tree"

if git log -p --all -S 'CLEANVERSE_API_KEY=' -- ':!app/.env.example' ':!*.keys.env.example' ':!clearnote.keys.env.example' 2>/dev/null | grep -E '^\+CLEANVERSE_API_KEY=.+' | grep -v '^\+CLEANVERSE_API_KEY=$' | head -1 | grep -q .; then
  fail "CLEANVERSE_API_KEY secret value found in git history"
fi
pass "no CLEANVERSE_API_KEY secrets in git history"

# Contract test count matches README
TEST_OUT=$(forge test 2>&1)
if echo "$TEST_OUT" | grep -qE '38 tests passed|38 passed'; then
  pass "forge test 38/38"
else
  echo "$TEST_OUT" | tail -5
  fail "forge test count mismatch (README claims 38)"
fi

echo ""
echo "=== WO-15 acceptance: ALL PASS ==="
