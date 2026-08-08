/**
 * Live Cleanverse sandbox probe — docs v5.6 plain JSON endpoints only.
 */
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

function ok(json) {
  return json?.code === 4 || json?.code === '0000'
}

async function postPlain(base, apiId, path, body) {
  const start = Date.now()
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-id': apiId },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  return { json, ms: Date.now() - start, ok: ok(json) }
}

async function getPlain(base, apiId, path) {
  const start = Date.now()
  const res = await fetch(`${base}${path}`, { headers: { 'api-id': apiId } })
  const json = await res.json()
  return { json, ms: Date.now() - start, ok: ok(json) }
}

const env = loadEnv(envPath)
const base = env.CLEANVERSE_API_BASE
const apiId = env.CLEANVERSE_API_ID
const walletA = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'
const walletB = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
const clinv01 = '0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69'

let allOk = true
const rows = []

function record(name, passed, ms, detail = '') {
  rows.push({ name, status: passed ? 'PASS' : 'FAIL', ms, detail })
  if (!passed) allOk = false
}

const q = await postPlain(base, apiId, '/query_apass', { chain: 'monad', address: walletA })
record('query_apass', q.ok, q.ms, q.ok ? '' : String(q.json.code))

const v = await postPlain(base, apiId, '/verify_apass', {
  chain: 'monad',
  atoken: clinv01,
  address: walletB,
})
const verifyOk = v.ok && v.json?.data?.code === 4
record('verify_apass', verifyOk, v.ms, verifyOk ? '' : String(v.json?.data?.code ?? v.json.code))

const txs = await postPlain(base, apiId, '/query_txs', {
  chain: 'monad',
  address: walletB,
  symbol: 'usdc',
  page: 1,
  pageSize: 5,
})
record('query_txs_usdc', txs.ok, txs.ms, txs.ok ? '' : String(txs.json.code))

const list = await getPlain(base, apiId, '/atoken/list_my_atokens?page=1&page_size=5&chain=monad')
record('list_my_atokens', list.ok, list.ms, list.ok ? '' : String(list.json.code))

console.log('| Endpoint | Status | ms | Detail |')
console.log('|----------|--------|-----|--------|')
for (const r of rows) {
  console.log(`| ${r.name} | ${r.status} | ${r.ms} | ${r.detail || '-'} |`)
}

if (!allOk) {
  console.error('cleanverse:doctor FAIL')
  process.exit(1)
}
console.log('cleanverse:doctor OK')
