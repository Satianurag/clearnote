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
    if (u.searchParams.get('sslmode') === 'require') out('ENVIO_PG_SSL_MODE', 'require');
  ")"
fi

# Private-network Hasura metadata endpoint (Render worker → Hasura web).
if [ -n "${HASURA_INTERNAL_HOSTPORT:-}" ]; then
  export HASURA_GRAPHQL_ENDPOINT="http://${HASURA_INTERNAL_HOSTPORT}/v1/metadata"
fi

if [ "${1:-start}" = "setup" ]; then
  pnpm db-setup
  exit 0
fi

if [ "${RUN_DB_SETUP:-true}" = "true" ]; then
  pnpm db-setup || true
fi

exec pnpm start
