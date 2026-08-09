#!/usr/bin/env bash
# Push local env files to linked Vercel project.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/app"

if [[ ! -d "$ROOT/.vercel" ]]; then
  echo "Link Vercel project first: cd $ROOT && npx vercel link --yes"
  exit 1
fi

cd "$ROOT"

push_public() {
  local name="$1"
  local value="$2"
  [[ -z "$name" || -z "$value" ]] && return 0
  npx vercel@latest env add "$name" production,preview,development \
    --value "$value" --no-sensitive --force --yes < /dev/null
  echo "  + $name"
}

push_secret() {
  local name="$1"
  local value="$2"
  [[ -z "$name" || -z "$value" ]] && return 0
  npx vercel@latest env add "$name" production,preview \
    --value "$value" --sensitive --force --yes < /dev/null
  echo "  + $name (secret)"
}

read_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    [[ "$line" =~ ^VERCEL_ ]] && continue
    local name="${line%%=*}"
    local value="${line#*=}"
    value="${value%\"}"
    value="${value#\"}"
    if [[ "$name" == "INDEXER_GRAPHQL_URL" && "$value" == *localhost* ]]; then
      continue
    fi
    case "$name" in
      CLEANVERSE_API_KEY|SESSION_SECRET|SAFE_*|*_PRIVATE_KEY|DEPLOYER_*|WALLET_*_PRIVATE_KEY)
        push_secret "$name" "$value"
        ;;
      NEXT_PUBLIC_*|CLEANVERSE_API_BASE|CLEANVERSE_API_ID|INDEXER_*)
        push_public "$name" "$value"
        ;;
      *)
        push_public "$name" "$value"
        ;;
    esac
  done < "$file"
}

echo "Syncing env to Vercel (clearnote)…"
read_env_file "$APP/.env.local"
read_env_file "$ROOT/clearnote.keys.env"
echo "Done."
