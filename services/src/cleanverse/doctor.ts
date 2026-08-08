import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CleanverseClient } from './client.js'
import { fallbackQueryTxs, fallbackVerifyApass, fallbackValidatorVerify } from './fallbacks.js'

const __dir = dirname(fileURLToPath(import.meta.url))

function loadEnv(path: string) {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

export async function runDoctor() {
  const envPath = process.env.CLEANVERSE_ENV ?? resolve(__dir, '../../../../cleanverse.env')
  const env = loadEnv(envPath)
  const client = new CleanverseClient({
    baseUrl: env.CLEANVERSE_API_BASE,
    apiId: env.CLEANVERSE_API_ID,
    apiKey: env.CLEANVERSE_API_KEY,
  })
  const rpc = env.MONAD_RPC ?? 'https://testnet-rpc.monad.xyz'
  const graphql = env.ENVIO_GRAPHQL ?? 'http://localhost:8082/v1/graphql'
  const sampleXml = resolve(__dir, '../../../seed/samples/invoice-factor-a.xml')

  const rows: Array<{ name: string; status: string; ms: number; fallback?: string }> = []

  const q = await client.queryApass('monad', '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB')
  rows.push({ name: 'query_apass', status: q.ok ? 'OK' : String(q.json.code), ms: q.ms })

  const v = await client.post('/verify_apass', {
    chain: 'monad',
    address: '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b',
    aToken: 'CLINV01',
  })
  const fb = await fallbackVerifyApass('0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b', rpc)
  rows.push({
    name: 'verify_apass',
    status: v.ok ? 'OK' : String(v.json.message ?? v.json.code),
    ms: v.ms,
    fallback: fb.method,
  })

  const val = await client.post('/validator/verify', {
    chain: 'monad',
    address: '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b',
    contract_address: '0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69',
  })
  const valFb = await fallbackValidatorVerify(sampleXml)
  rows.push({
    name: 'validator/verify',
    status: val.ok ? 'OK' : String(val.json.code),
    ms: val.ms,
    fallback: valFb.method,
  })

  const txs = await fallbackQueryTxs(graphql)
  rows.push({ name: 'query_txs', status: 'BROKEN', ms: 0, fallback: `Envio count=${txs.count}` })

  const list = await client.get('/atoken/list_my_atokens')
  rows.push({ name: 'list_my_atokens', status: list.ok ? 'OK' : String(list.json.code), ms: list.ms })

  console.log('| Endpoint | Status | ms | Fallback |')
  console.log('|----------|--------|-----|----------|')
  for (const r of rows) {
    console.log(`| ${r.name} | ${r.status} | ${r.ms} | ${r.fallback ?? '-'} |`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDoctor().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
