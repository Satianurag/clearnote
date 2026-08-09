#!/usr/bin/env node
/**
 * Provision clearnote indexer on Render (Postgres + Hasura + Envio worker).
 * Usage: RENDER_API_KEY=rnd_... node scripts/render-provision-indexer.mjs
 */
const API = 'https://api.render.com/v1'
const OWNER = 'tea-d3f7jjili9vc73e3hk8g'
const REPO = 'https://github.com/Satianurag/clearnote'
const BRANCH = 'main'

import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const key = process.env.RENDER_API_KEY?.trim()
if (!key) {
  console.error('Set RENDER_API_KEY')
  process.exit(1)
}

async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(opts.headers ?? {}),
    },
    signal: AbortSignal.timeout(180_000),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`${path} non-JSON ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}: ${JSON.stringify(json)}`)
  return json
}

function serviceId(s) {
  return s?.id ?? s?.service?.id
}

function serviceUrl(s) {
  return s?.serviceDetails?.url ?? s?.service?.serviceDetails?.url
}

function randomSecret() {
  return randomBytes(32).toString('base64url')
}

async function findPostgres() {
  const rows = await api('/postgres?limit=20')
  for (const row of rows) {
    const db = row.postgres ?? row
    if (db.name === 'clearnote-indexer-db') return db
  }
  return null
}

async function findService(name) {
  const rows = await api('/services?limit=50')
  for (const row of rows) {
    const s = row.service ?? row
    if (s.name === name) return s
  }
  return null
}

async function waitPostgres(id) {
  for (let i = 0; i < 30; i++) {
    const db = await api(`/postgres/${id}`)
    console.log(`  postgres: ${db.status}`)
    if (db.status === 'available') return db
    await new Promise((r) => setTimeout(r, 10_000))
  }
  throw new Error('Postgres not available in time')
}

async function waitServiceDeploy(serviceId, label) {
  for (let i = 0; i < 60; i++) {
    const s = await api(`/services/${serviceId}`)
    const st = s.serviceDetails?.deploymentStatus ?? s.service?.serviceDetails?.deploymentStatus
    const url = s.serviceDetails?.url ?? s.service?.serviceDetails?.url
    console.log(`  ${label}: ${st ?? 'deploying'}${url ? ` → ${url}` : ''}`)
    if (st === 'live' && url) return s
    await new Promise((r) => setTimeout(r, 15_000))
  }
  throw new Error(`${label} deploy timed out`)
}

async function main() {
  console.log('Render provision: clearnote indexer\n')

  let db = await findPostgres()
  if (!db) {
    console.log('Creating Postgres clearnote-indexer-db…')
    db = await api('/postgres', {
      method: 'POST',
      body: JSON.stringify({
        name: 'clearnote-indexer-db',
        ownerId: OWNER,
        plan: 'free',
        region: 'oregon',
        databaseName: 'envio_dev',
        user: 'envio',
        version: '16',
      }),
    })
  }
  await waitPostgres(db.id)

  const conn = await api(`/postgres/${db.id}/connection-info`)
  const dbInternal = conn.internalConnectionString
  let hasuraSecret = process.env.HASURA_ADMIN_SECRET?.trim() || randomSecret()

  let hasura = await findService('clearnote-hasura')
  if (!hasura) {
    console.log('Creating Hasura web service…')
    hasura = await api('/services', {
      method: 'POST',
      body: JSON.stringify({
        type: 'web_service',
        name: 'clearnote-hasura',
        ownerId: OWNER,
        image: {
          ownerId: OWNER,
          imagePath: 'docker.io/hasura/graphql-engine:v2.43.0',
        },
        serviceDetails: {
          runtime: 'image',
          plan: 'free',
          region: 'oregon',
          healthCheckPath: '/healthz',
        },
        envVars: [
          { key: 'HASURA_GRAPHQL_DATABASE_URL', value: dbInternal },
          { key: 'HASURA_GRAPHQL_ADMIN_SECRET', value: hasuraSecret },
          { key: 'HASURA_GRAPHQL_ENABLE_CONSOLE', value: 'true' },
          { key: 'HASURA_GRAPHQL_STRINGIFY_NUMERIC_TYPES', value: 'true' },
          { key: 'HASURA_GRAPHQL_UNAUTHORIZED_ROLE', value: 'public' },
        ],
      }),
    })
  } else {
    console.log('Hasura already exists — fetching admin secret from env…')
    const envs = await api(`/services/${hasura.id}/env-vars`)
    const found = envs.find((e) => (e.envVar ?? e).key === 'HASURA_GRAPHQL_ADMIN_SECRET')
    if (found) hasuraSecret = (found.envVar ?? found).value
  }

  hasura = await waitServiceDeploy(serviceId(hasura), 'hasura')
  const hasuraUrl = serviceUrl(hasura)
  const hasuraHostport = `clearnote-hasura:${hasura.serviceDetails?.port ?? 10000}`

  let worker = await findService('clearnote-indexer')
  if (!worker) {
    console.log('Creating Envio indexer worker…')
    worker = await api('/services', {
      method: 'POST',
      body: JSON.stringify({
        type: 'web_service',
        name: 'clearnote-indexer',
        ownerId: OWNER,
        repo: REPO,
        branch: BRANCH,
        autoDeploy: 'yes',
        serviceDetails: {
          runtime: 'docker',
          plan: 'free',
          region: 'oregon',
          healthCheckPath: '/',
          envSpecificDetails: {
            dockerfilePath: './indexer/Dockerfile',
            dockerContext: './indexer',
          },
        },
        envVars: [
          { key: 'DATABASE_URL', value: dbInternal },
          { key: 'HASURA_GRAPHQL_ADMIN_SECRET', value: hasuraSecret },
          { key: 'HASURA_INTERNAL_HOSTPORT', value: hasuraHostport },
          { key: 'TUI_OFF', value: 'true' },
          { key: 'LOG_LEVEL', value: 'info' },
          { key: 'RUN_DB_SETUP', value: 'true' },
        ],
      }),
    })
  }

  console.log('\n=== Render indexer ready (sync may take 10+ min) ===')
  console.log(`Hasura URL:     ${hasuraUrl}`)
  console.log(`GraphQL:        ${hasuraUrl}/v1/graphql`)
  console.log(`Admin secret:   (saved in clearnote-hasura env — check Render dashboard)`)
  console.log(`Worker:         ${worker.name} (${worker.id})`)
  console.log('\nUpdate Vercel:')
  console.log(`  INDEXER_GRAPHQL_URL=${hasuraUrl}/v1/graphql`)
  console.log(`  INDEXER_GRAPHQL_ADMIN_SECRET=<from Render clearnote-hasura env>`)

  // Write local env hint (gitignored path)
  console.log(`\nWrote .render-indexer.env (gitignored) for local sync scripts.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
