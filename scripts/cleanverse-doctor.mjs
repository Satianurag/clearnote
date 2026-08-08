/**
 * Live Cleanverse sandbox probe — CVA integration (docs v5.6).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))
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
const clinv01 = deploy.e2e?.clinv01 ?? '0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69'
const ausdc = deploy.e2e?.cva_ausdc ?? '0xaC0893567D43C3E7e6e35a72803df05416C1f20D'
const pool = deploy.compliancePool ?? deploy.e2e?.compliancePool ?? '0x8eC6b0CcC52aBf6dB6f71844eD468f20EA427748'

let allOk = true
const rows = []

function record(name, passed, ms, detail = '') {
  rows.push({ name, status: passed ? 'PASS' : 'FAIL', ms, detail })
  if (!passed) allOk = false
}

const q = await postPlain(base, apiId, '/query_apass', { chain: 'monad', address: walletA })
record('query_apass', q.ok, q.ms, q.ok ? '' : String(q.json.code))

const vNote = await postPlain(base, apiId, '/verify_apass', {
  chain: 'monad',
  atoken: clinv01,
  address: walletB,
})
record(
  'verify_apass_clinv01',
  vNote.ok && vNote.json?.data?.code === 4,
  vNote.ms,
  vNote.ok ? '' : String(vNote.json?.data?.code ?? vNote.json.code),
)

const vCash = await postPlain(base, apiId, '/verify_apass', {
  chain: 'monad',
  atoken: ausdc,
  address: walletB,
})
record(
  'verify_apass_ausdc',
  vCash.ok && vCash.json?.data?.code === 4,
  vCash.ms,
  vCash.ok ? '' : String(vCash.json?.data?.code ?? vCash.json.code),
)

const deposit = await postPlain(base, apiId, '/query_deposit_atoken_list', { chain: 'monad' })
const hasAusdc = deposit.json?.data?.tokens?.some(
  (t) => t.atoken?.address?.toLowerCase() === ausdc.toLowerCase(),
)
record(
  'query_deposit_atoken_list',
  deposit.ok && hasAusdc,
  deposit.ms,
  hasAusdc ? `ausdc=${ausdc}` : String(deposit.json.code),
)

const txs = await postPlain(base, apiId, '/query_txs', {
  chain: 'monad',
  address: walletB,
  symbol: 'ausdc',
  page: 1,
  pageSize: 5,
})
record('query_txs_ausdc', txs.ok, txs.ms, txs.ok ? '' : String(txs.json.code))

const list = await getPlain(base, apiId, '/atoken/list_my_atokens?page=1&page_size=5&chain=monad')
record('list_my_atokens', list.ok, list.ms, list.ok ? '' : String(list.json.code))

const reg = await postPlain(base, apiId, '/validator/is_register', {
  chain: 'monad',
  contract_address: pool,
})
const registered = reg.json?.data?.registered
record(
  'validator_is_register',
  reg.ok && registered === true,
  reg.ms,
  registered ? `pool=${pool}` : 'not registered',
)

const verify = await postPlain(base, apiId, '/validator/verify', {
  chain: 'monad',
  contract_address: pool,
  user_address: walletB,
})
record(
  'validator_verify_pool',
  verify.ok && verify.json?.data?.valid === true,
  verify.ms,
  verify.ok ? `valid=${verify.json?.data?.valid}` : String(verify.json.code),
)

const ramp = await postPlain(base, apiId, '/query_ramp_payment_methods', {})
record('query_ramp_payment_methods', ramp.ok, ramp.ms, ramp.ok ? '' : String(ramp.json.code))

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
