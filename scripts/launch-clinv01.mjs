/**
 * Launch CLINV01 on Monad via Cleanverse atoken/launch API.
 * Usage: node scripts/launch-clinv01.mjs
 */
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

async function cvRequest(base, apiId, apiKey, endpoint, body) {
  const res = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-id': apiId },
    body: JSON.stringify({ data: encryptPayload(body, apiKey) }),
  })
  const json = await res.json()
  const ok = json.code === 4 || json.code === '0000'
  return { ok, json, data: json.data ?? json.result }
}

const cleanverse = loadEnv(resolve('/home/sati/Desktop/cleanverse.env'))
const keys = loadEnv(resolve(root, 'clearnote.keys.env'))
const walletA = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'

const symbols = ['CLINV01', 'CLINV02', 'CLINV03', 'CLNOTE03']

for (const symbol of symbols) {
  const body = {
    chain: 'monad',
    token_name: 'ClearNote Invoice Note',
    token_symbol: symbol,
    decimals: 18,
    admin_address: walletA,
    icon: 'https://images.cleanverse.com/app/token_icon/USDC.svg',
    rule: { min_tier: 0, min_sub_tier: 0, is_black_list: false, countries: [] },
  }
  console.log(`\n=== Launch ${symbol} ===`)
  const { ok, json, data } = await cvRequest(
    cleanverse.CLEANVERSE_API_BASE,
    cleanverse.CLEANVERSE_API_ID,
    cleanverse.CLEANVERSE_API_KEY,
    '/atoken/launch',
    body,
  )
  console.log('code:', json.code, 'message:', json.message)
  if (ok) {
    console.log('SUCCESS:', JSON.stringify(data, null, 2))
    const addr = data?.contract_address ?? data?.token_address ?? data?.address
    if (addr) {
      writeFileSync(resolve(root, 'deployments/clinv01.json'), JSON.stringify({ symbol, address: addr, launchedAt: new Date().toISOString() }, null, 2))
    }
    process.exit(0)
  }
  console.log('raw:', JSON.stringify(json))
}

console.error('All symbol attempts failed')
process.exit(1)
