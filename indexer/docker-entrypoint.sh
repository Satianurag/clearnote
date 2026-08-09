#!/bin/sh
set -eu

cd /indexer/generated

# Render Postgres — parse DATABASE_URL into Envio PG env vars.
if [ -n "${DATABASE_URL:-}" ]; then
  eval "$(node -e "
    const raw = process.env.DATABASE_URL;
    const u = new URL(raw.replace(/^postgres:/, 'postgresql:'));
    const out = (k, v) => console.log('export ' + k + '=' + JSON.stringify(String(v)));
    out('ENVIO_PG_HOST', u.hostname);
    out('ENVIO_PG_PORT', u.port || '5432');
    out('ENVIO_PG_USER', decodeURIComponent(u.username));
    out('ENVIO_POSTGRES_PASSWORD', decodeURIComponent(u.password));
    out('ENVIO_PG_DATABASE', u.pathname.replace(/^\//, ''));
    out('ENVIO_PG_SSL_MODE', 'require');
  ")"
fi

export METRICS_PORT=${PORT:-9898}
export ENVIO_INDEXER_HOST=0.0.0.0
export ENVIO_INDEXER_PORT=${METRICS_PORT}

# Hasura metadata API — prefer explicit endpoint, else private hostport from Render.
if [ -n "${HASURA_GRAPHQL_ENDPOINT:-}" ]; then
  :
elif [ -n "${HASURA_INTERNAL_HOSTPORT:-}" ]; then
  export HASURA_GRAPHQL_ENDPOINT="http://${HASURA_INTERNAL_HOSTPORT}/v1/metadata"
elif [ -n "${HASURA_PUBLIC_URL:-}" ]; then
  export HASURA_GRAPHQL_ENDPOINT="${HASURA_PUBLIC_URL%/}/v1/metadata"
fi

if [ "${1:-start}" = "setup" ]; then
  pnpm db-setup
  exit 0
fi

# Run schema setup in background so /healthz is up for Render health checks.
if [ "${RUN_DB_SETUP:-true}" = "true" ]; then
  pnpm db-setup > /tmp/db-setup.log 2>&1 &
fi

exec pnpm start
