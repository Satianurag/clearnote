/** Poll Cleanverse for CLINV01 token address after async launch */
import crypto from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')

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

function encryptPayload(obj, apiKey) {
  let key = apiKey.endsWith('=') ? Buffer.from(apiKey, 'base64') : Buffer.from(apiKey, 'utf8')
  if (key.length !== 32) {
    const padded = Buffer.alloc(32, 0)
    key.copy(padded, 0, 0, Math.min(key.length, 32))
    key = padded
  }
  const iv = Buffer.alloc(16, 0)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let enc = cipher.update(JSON.stringify(obj), 'utf8', 'base64')
  enc += cipher.final('base64')
  return enc
}

async function cvGet(base, apiId, apiKey, endpoint, body = {}) {
  const url = `${base}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-id': apiId },
    body: JSON.stringify({ data: encryptPayload(body, apiKey) }),
  })
  const json = await res.json()
  const ok = json.code === 4 || json.code === '0000'
  return { ok, json, data: json.data ?? json.result }
}

const cleanverse = loadEnv(resolve('/home/sati/Desktop/cleanverse.env'))
const walletA = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'

for (let i = 0; i < 12; i++) {
  const { ok, json, data } = await cvGet(
    cleanverse.CLEANVERSE_API_BASE,
    cleanverse.CLEANVERSE_API_ID,
    cleanverse.CLEANVERSE_API_KEY,
    '/atoken/list_my_atokens',
    { chain: 'monad', wallet_address: walletA },
  )
  console.log(`poll ${i + 1}: code=${json.code}`)
  const list = data?.tokens ?? data?.atokens ?? data ?? []
  const arr = Array.isArray(list) ? list : []
  for (const t of arr) {
    const sym = t.token_symbol ?? t.symbol ?? t.tokenSymbol
    const addr = t.contract_address ?? t.token_address ?? t.address
    console.log(`  ${sym}: ${addr}`)
    if (sym && String(sym).toUpperCase().startsWith('CLINV')) {
      writeFileSync(
        resolve(root, 'deployments/clinv01.json'),
        JSON.stringify({ symbol: sym, address: addr, raw: t, polledAt: new Date().toISOString() }, null, 2),
      )
      console.log('Written deployments/clinv01.json')
      process.exit(0)
    }
  }
  await new Promise((r) => setTimeout(r, 15000))
}
console.error('CLINV token not found after polling')
process.exit(1)
