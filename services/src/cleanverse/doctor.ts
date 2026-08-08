import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CleanverseClient } from './client.js'

const __dir = dirname(fileURLToPath(import.meta.url))

const WALLET_A = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'
const WALLET_B = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
const CLINV01 = '0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69'

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

  const rows: Array<{ name: string; status: string; ms: number }> = []
  let ok = true

  function pass(name: string, ms: number) {
    rows.push({ name, status: 'PASS', ms })
    console.log(`PASS ${name} (${ms}ms)`)
  }

  function fail(name: string, ms: number, detail: string) {
    rows.push({ name, status: 'FAIL', ms })
    console.error(`FAIL ${name} (${ms}ms): ${detail}`)
    ok = false
  }

  const q = await client.queryApass('monad', WALLET_A)
  if (q.ok) pass('query_apass', q.ms)
  else fail('query_apass', q.ms, String(q.json.code ?? q.json.message))

  const v = await client.verifyApass('monad', CLINV01, WALLET_B)
  const inner = (v.json?.data ?? v.data) as { code?: number; message?: string } | undefined
  if (v.ok && inner?.code === 4) pass('verify_apass', v.ms)
  else fail('verify_apass', v.ms, String(inner?.message ?? v.json.code ?? 'not code 4'))

  const txs = await client.queryTxs('monad', WALLET_B, { symbol: 'usdc', page: 1, pageSize: 5 })
  if (txs.ok) pass('query_txs_usdc', txs.ms)
  else fail('query_txs_usdc', txs.ms, String(txs.json.code ?? txs.json.message))

  const list = await client.listMyAtokens({ page: 1, pageSize: 5, chain: 'monad' })
  if (list.ok) pass('list_my_atokens', list.ms)
  else fail('list_my_atokens', list.ms, String(list.json.code ?? list.json.message))

  console.log('')
  console.log('| Endpoint | Status | ms |')
  console.log('|----------|--------|-----|')
  for (const r of rows) {
    console.log(`| ${r.name} | ${r.status} | ${r.ms} |`)
  }

  if (!ok) {
    console.error('cleanverse:doctor FAIL')
    process.exit(1)
  }
  console.log('cleanverse:doctor OK')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDoctor().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
