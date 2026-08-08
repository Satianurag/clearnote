#!/bin/sh
set -eu

cd /indexer/generated

if [ "${1:-start}" = "setup" ]; then
  pnpm db-setup
  exit 0
fi

if [ "${RUN_DB_SETUP:-true}" = "true" ]; then
  pnpm db-setup || true
fi

exec pnpm start
