/** add_rule for CLINV01 — countries [] required before mint */
import crypto from 'crypto'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dir, '..')
const clinv = JSON.parse(readFileSync(resolve(root, 'deployments/clinv01.json'), 'utf8'))

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
  const key = Buffer.from(apiKey, 'base64')
  const iv = Buffer.alloc(16, 0)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  let enc = cipher.update(JSON.stringify(obj), 'utf8', 'base64')
  enc += cipher.final('base64')
  return enc
}

const cleanverse = loadEnv(resolve('/home/sati/Desktop/cleanverse.env'))

const rule = { min_tier: 0, min_sub_tier: 0, is_black_list: false, countries: [] }
const attempts = [
  { chain: 'monad', atokenAddress: clinv.address, ...rule },
  { chain: 'monad', atoken_address: clinv.address, rule },
  { chain: 'monad', token_symbol: clinv.symbol, rule },
  { chain: 'monad', atokenAddress: clinv.address, minTier: '0', is_black_list: false, countries: [] },
]

for (const body of attempts) {
  const res = await fetch(`${cleanverse.CLEANVERSE_API_BASE}/atoken/add_rule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-id': cleanverse.CLEANVERSE_API_ID },
    body: JSON.stringify({ data: encryptPayload(body, cleanverse.CLEANVERSE_API_KEY) }),
  })
  const json = await res.json()
  console.log('attempt', JSON.stringify(body).slice(0, 80), '→', json.code, json.message || '')
  if (json.code === '0000' || json.code === 4) break
}
