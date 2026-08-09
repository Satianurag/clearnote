#!/usr/bin/env node
/** Create clearnote-indexer worker if missing. */
const key = process.env.RENDER_API_KEY?.trim()
if (!key) process.exit(1)
const OWNER = 'tea-d3f7jjili9vc73e3hk8g'

async function api(path, opts = {}) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(json))
  return json
}

const envs = await api('/services/srv-d9smvvqjnfac739pnijg/env-vars')
const secret = envs.find((e) => (e.envVar ?? e).key === 'HASURA_GRAPHQL_ADMIN_SECRET')
const hasuraSecret = (secret?.envVar ?? secret)?.value
const db = (await api('/postgres/dpg-d9smujp42hec73bd1qf0-a/connection-info')).internalConnectionString

const body = {
  type: 'web_service',
  name: 'clearnote-indexer',
  ownerId: OWNER,
  repo: 'https://github.com/Satianurag/clearnote',
  branch: 'main',
  autoDeploy: 'yes',
  serviceDetails: {
    runtime: 'docker',
    plan: 'free',
    region: 'oregon',
    healthCheckPath: '/',
    envSpecificDetails: { dockerfilePath: './indexer/Dockerfile', dockerContext: './indexer' },
  },
  envVars: [
    { key: 'DATABASE_URL', value: db },
    { key: 'HASURA_GRAPHQL_ADMIN_SECRET', value: hasuraSecret },
    { key: 'HASURA_INTERNAL_HOSTPORT', value: 'clearnote-hasura:10000' },
    { key: 'TUI_OFF', value: 'true' },
    { key: 'LOG_LEVEL', value: 'info' },
    { key: 'RUN_DB_SETUP', value: 'true' },
  ],
}

try {
  const w = await api('/services', { method: 'POST', body: JSON.stringify(body) })
  console.log('created', w.id ?? w.service?.id ?? w)
} catch (e) {
  console.error(e.message)
}
