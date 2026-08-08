#!/usr/bin/env bash
# WO-00 acceptance checks
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
pass() { echo -e "${GREEN}✓${NC} $1"; }
fail() { echo -e "${RED}✗${NC} $1"; exit 1; }

echo "=== WO-00 verify ==="

forge build && pass "forge build"

pnpm -r typecheck && pass "pnpm -r typecheck"

SECRET="${HASURA_GRAPHQL_ADMIN_SECRET:-testing}"
node scripts/verify-indexer.mjs && pass "indexer GraphQL entity counts"

STAGED=$(git diff --cached --name-only 2>/dev/null || true)
if echo "$STAGED" | grep -qE '(^\.env$|[^.]keys\.env$|clearnote\.keys\.env$)'; then
  fail "staged env/key files"
fi
if echo "$STAGED" | grep -qE '^(contracts/out/|cache/)'; then
  fail "staged build artifacts"
fi
pass "git status clean for secrets/out"

if git grep -iE '(PRIVATE_KEY|privateKey)\s*=\s*0x[a-fA-F0-9]{64}' -- ':!*.keys.env.example' ':!clearnote.keys.env.example' ':!docs/' 2>/dev/null; then
  fail "private key literals in tracked files"
fi
pass "no private keys in tracked files"

echo ""
echo "=== WO-00 acceptance: ALL PASS ==="
