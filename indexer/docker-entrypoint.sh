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
    out('ENVIO_PG_SSL_MODE', u.hostname.includes('.render.com') ? 'require' : 'prefer');
  ")"
fi

export METRICS_PORT=${PORT:-9898}
export ENVIO_INDEXER_HOST=0.0.0.0
export ENVIO_INDEXER_PORT=${METRICS_PORT}
export HASURA_GRAPHQL_ROLE=${HASURA_GRAPHQL_ROLE:-admin}

if [ -z "${HASURA_GRAPHQL_ENDPOINT:-}" ]; then
  if [ -n "${HASURA_INTERNAL_HOSTPORT:-}" ]; then
    export HASURA_GRAPHQL_ENDPOINT="http://${HASURA_INTERNAL_HOSTPORT}/v1/metadata"
  elif [ -n "${HASURA_PUBLIC_URL:-}" ]; then
    export HASURA_GRAPHQL_ENDPOINT="${HASURA_PUBLIC_URL%/}/v1/metadata"
  else
    export HASURA_GRAPHQL_ENDPOINT="http://localhost:8080/v1/metadata"
  fi
fi

if [ "${1:-start}" = "setup" ]; then
  pnpm db-setup
  exit $?
fi

if [ "${RUN_DB_SETUP:-false}" = "true" ]; then
  pnpm db-setup
fi

exec pnpm start
