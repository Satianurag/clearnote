#!/usr/bin/env bash
# Build clearnote-upload.zip on Desktop — excludes secrets, deps, and build artifacts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="/home/sati/Desktop/clearnote-upload.zip"

rm -f "$OUT"
cd "$ROOT"

# Zip from repo root; -x patterns match zip's internal paths (no leading ./)
zip -rq "$OUT" . \
  -x ".git/*" \
  -x "*node_modules*" \
  -x "*.next/*" \
  -x "*/dist/*" \
  -x "*/out/*" \
  -x "*/cache/*" \
  -x "indexer/generated/*" \
  -x "contracts/out/*" \
  -x "contracts/cache/*" \
  -x "clearnote.keys.env" \
  -x "*.keys.env" \
  -x ".env.local" \
  -x "*/.env.local" \
  -x "*/.env*.local" \
  -x "indexer/.env*" \
  -x "*.tsbuildinfo"

echo "Created $OUT ($(du -h "$OUT" | awk '{print $1}'), $(unzip -l "$OUT" | tail -1))"
