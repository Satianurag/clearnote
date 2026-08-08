import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CleanverseClient } from './client.js'

const __dir = dirname(fileURLToPath(import.meta.url))

const deploy = JSON.parse(readFileSync(resolve(__dir, '../../../deployments/monad-10143.json'), 'utf8'))

const WALLET_A = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'
const WALLET_B = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
const CLINV01 = deploy.e2e?.clinv01 ?? '0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69'
const AUSDC = deploy.e2e?.cva_ausdc ?? '0xaC0893567D43C3E7e6e35a72803df05416C1f20D'
const COMPLIANCE_POOL =
  deploy.compliancePool ?? deploy.e2e?.compliancePool ?? '0x8eC6b0CcC52aBf6dB6f71844eD468f20EA427748'

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

  const rows: Array<{ name: string; status: string; ms: number; detail?: string }> = []
  let ok = true

  function pass(name: string, ms: number, detail = '') {
    rows.push({ name, status: 'PASS', ms, detail })
    console.log(`PASS ${name} (${ms}ms)${detail ? ` — ${detail}` : ''}`)
  }

  function fail(name: string, ms: number, detail: string) {
    rows.push({ name, status: 'FAIL', ms, detail })
    console.error(`FAIL ${name} (${ms}ms): ${detail}`)
    ok = false
  }

  const q = await client.queryApass('monad', WALLET_A)
  if (q.ok) pass('query_apass', q.ms)
  else fail('query_apass', q.ms, String(q.json.code ?? q.json.message))

  const vNote = await client.verifyApass('monad', CLINV01, WALLET_B)
  const innerNote = (vNote.json?.data ?? vNote.data) as { code?: number; message?: string } | undefined
  if (vNote.ok && innerNote?.code === 4) pass('verify_apass_clinv01', vNote.ms)
  else fail('verify_apass_clinv01', vNote.ms, String(innerNote?.message ?? vNote.json.code ?? 'not code 4'))

  const vCash = await client.verifyApass('monad', AUSDC, WALLET_B)
  const innerCash = (vCash.json?.data ?? vCash.data) as { code?: number; message?: string } | undefined
  if (vCash.ok && innerCash?.code === 4) pass('verify_apass_ausdc', vCash.ms)
  else fail('verify_apass_ausdc', vCash.ms, String(innerCash?.message ?? vCash.json.code ?? 'not code 4'))

  const deposit = await client.queryDepositAtokenList('monad')
  const tokens = (deposit.data as { tokens?: Array<{ atoken?: { address?: string } }> })?.tokens
  const hasAusdc = tokens?.some((t) => t.atoken?.address?.toLowerCase() === AUSDC.toLowerCase())
  if (deposit.ok && hasAusdc) pass('query_deposit_atoken_list', deposit.ms, `ausdc=${AUSDC}`)
  else fail('query_deposit_atoken_list', deposit.ms, String(deposit.json.code ?? 'no ausdc pair'))

  const txsAusdc = await client.queryTxs('monad', WALLET_B, { symbol: 'ausdc', page: 1, pageSize: 5 })
  if (txsAusdc.ok) pass('query_txs_ausdc', txsAusdc.ms)
  else fail('query_txs_ausdc', txsAusdc.ms, String(txsAusdc.json.code ?? txsAusdc.json.message))

  const list = await client.listMyAtokens({ page: 1, pageSize: 5, chain: 'monad' })
  if (list.ok) pass('list_my_atokens', list.ms)
  else fail('list_my_atokens', list.ms, String(list.json.code ?? list.json.message))

  const reg = await client.validatorIsRegister('monad', COMPLIANCE_POOL)
  const registered = (reg.data as { registered?: boolean } | undefined)?.registered
  if (reg.ok && registered) {
    pass('validator_is_register', reg.ms, `pool=${COMPLIANCE_POOL}`)
  } else {
    fail(
      'validator_is_register',
      reg.ms,
      registered ? String(reg.json.code) : 'not registered — pnpm validator:register-pool',
    )
  }

  const verify = await client.validatorVerify('monad', COMPLIANCE_POOL, WALLET_B)
  if (verify.ok && (verify.data as { valid?: boolean })?.valid === true) {
    pass('validator_verify_pool', verify.ms, 'valid=true')
  } else if (verify.ok) {
    fail('validator_verify_pool', verify.ms, `valid=${(verify.data as { valid?: boolean })?.valid}`)
  } else {
    fail('validator_verify_pool', verify.ms, String(verify.json.code ?? verify.json.message))
  }

  const ramp = await client.queryRampPaymentMethods()
  if (ramp.ok) pass('query_ramp_payment_methods', ramp.ms)
  else fail('query_ramp_payment_methods', ramp.ms, String(ramp.json.code ?? ramp.json.message))

  console.log('')
  console.log('| Endpoint | Status | ms | Detail |')
  console.log('|----------|--------|-----|--------|')
  for (const r of rows) {
    console.log(`| ${r.name} | ${r.status} | ${r.ms} | ${r.detail ?? '-'} |`)
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
