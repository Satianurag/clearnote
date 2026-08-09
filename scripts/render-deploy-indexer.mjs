#!/usr/bin/env node
/**
 * Apply render.yaml to Render and print Hasura URL for Vercel INDEXER_GRAPHQL_URL.
 * Usage: RENDER_API_KEY=rnd_... node scripts/render-deploy-indexer.mjs
 */
const API = 'https://api.render.com/v1'
const REPO = 'https://github.com/Satianurag/clearnote'
const BRANCH = 'main'

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
    signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    throw new Error(`${path} non-JSON ${res.status}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}: ${JSON.stringify(json)}`)
  }
  return json
}

async function findBlueprint() {
  const list = await api('/blueprints?limit=50')
  return list.find((b) => b.repo === REPO)?.id ?? null
}

async function waitDeploy(blueprintId, maxMs = 900_000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const b = await api(`/blueprints/${blueprintId}`)
    const st = b.status ?? b.syncStatus
    console.log(`  blueprint status: ${st}`)
    if (st === 'live' || st === 'synced') return b
    if (st === 'failed' || st === 'error') throw new Error(`Blueprint failed: ${JSON.stringify(b)}`)
    await new Promise((r) => setTimeout(r, 15_000))
  }
  throw new Error('Blueprint sync timed out')
}

async function findHasuraService() {
  const list = await api('/services?limit=50')
  for (const row of list) {
    const s = row.service ?? row
    if (s.name === 'clearnote-hasura') return s
  }
  return null
}

async function main() {
  console.log(`Render deploy: ${REPO} @ ${BRANCH}\n`)

  let blueprintId = await findBlueprint()
  if (!blueprintId) {
    console.log('Creating blueprint from render.yaml…')
    const created = await api('/blueprints', {
      method: 'POST',
      body: JSON.stringify({ repo: REPO, branch: BRANCH, autoSync: true }),
    })
    blueprintId = created.id
    console.log(`  blueprint id: ${blueprintId}`)
  } else {
    console.log(`Syncing existing blueprint ${blueprintId}…`)
    await api(`/blueprints/${blueprintId}/sync`, { method: 'POST', body: '{}' })
  }

  console.log('Waiting for blueprint sync (first deploy may take 10–15 min)…')
  await waitDeploy(blueprintId)

  const hasura = await findHasuraService()
  if (!hasura?.serviceDetails?.url) {
    console.log('\nBlueprint synced. Hasura URL not ready yet — check Render dashboard.')
    return
  }

  const gql = `${hasura.serviceDetails.url.replace(/\/$/, '')}/v1/graphql`
  console.log(`\nHasura GraphQL: ${gql}`)
  console.log('\nSet on Vercel:')
  console.log(`  INDEXER_GRAPHQL_URL=${gql}`)
  console.log('  INDEXER_GRAPHQL_ADMIN_SECRET=<from clearnote-hasura env in Render dashboard>')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
