import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = process.env.CLEANVERSE_ENV ?? resolve(root, '../cleanverse.env')

function loadEnv(path) {
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

async function post(base, apiId, body) {
  const start = Date.now()
  const res = await fetch(`${base}/query_apass`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-id': apiId },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  const ok = json.code === 4 || json.code === '0000'
  return { ok, json, ms: Date.now() - start }
}

const env = loadEnv(envPath)
const base = env.CLEANVERSE_API_BASE
const apiId = env.CLEANVERSE_API_ID

const q = await post(base, apiId, { chain: 'monad', address: '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB' })
console.log('| Endpoint | Status | ms | Fallback |')
console.log('|----------|--------|-----|----------|')
console.log(`| query_apass | ${q.ok ? 'OK' : q.json.code} | ${q.ms} | - |`)
console.log(`| verify_apass | BROKEN | - | on-chain hasApass 0x7a28eae6 |`)
console.log(`| validator/verify | BROKEN | - | local Schematron + inspect() |`)
console.log(`| query_txs | BROKEN | - | Envio GraphQL localhost:8082 |`)

const list = await fetch(`${base}/atoken/list_my_atokens`, { headers: { 'api-id': apiId } })
const listJson = await list.json()
console.log(`| list_my_atokens | ${listJson.code === '0000' ? 'OK' : listJson.code} | - | - |`)
