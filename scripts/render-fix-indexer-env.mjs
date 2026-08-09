#!/usr/bin/env node
const key = process.env.RENDER_API_KEY?.trim()
if (!key) process.exit(1)

async function api(path, opts = {}) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(json))
  return json
}

const secret = (
  await api('/services/srv-d9smvvqjnfac739pnijg/env-vars')
).find((e) => (e.envVar ?? e).key === 'HASURA_GRAPHQL_ADMIN_SECRET')
const hasuraSecret = (secret?.envVar ?? secret)?.value

const db = (await api('/postgres/dpg-d9smujp42hec73bd1qf0-a/connection-info')).internalConnectionString

const envVars = [
  { key: 'DATABASE_URL', value: db },
  { key: 'HASURA_GRAPHQL_ADMIN_SECRET', value: hasuraSecret },
  { key: 'HASURA_PUBLIC_URL', value: 'https://clearnote-hasura.onrender.com' },
  { key: 'HASURA_GRAPHQL_ENDPOINT', value: 'https://clearnote-hasura.onrender.com/v1/metadata' },
  { key: 'HASURA_INTERNAL_HOSTPORT', value: 'clearnote-hasura:10000' },
  { key: 'TUI_OFF', value: 'true' },
  { key: 'LOG_LEVEL', value: 'info' },
  { key: 'RUN_DB_SETUP', value: 'false' },
]

await api('/services/srv-d9sn7vafngtc73fm0rvg', {
  method: 'PATCH',
  body: JSON.stringify({
    serviceDetails: {
      envSpecificDetails: {
        preDeployCommand: '/docker-entrypoint.sh setup',
      },
    },
  }),
})
console.log('preDeployCommand set')

const saved = await api('/services/srv-d9sn7vafngtc73fm0rvg/env-vars', {
  method: 'PUT',
  body: JSON.stringify(envVars),
})
console.log('env keys:', saved.map((e) => (e.envVar ?? e).key).join(', '))

const dep = await api('/services/srv-d9sn7vafngtc73fm0rvg/deploys', { method: 'POST', body: '{}' })
console.log('deploy:', dep.status, dep.id)
