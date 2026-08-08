#!/usr/bin/env node
/**
 * Register CLINV01 with Cleanverse catalog (POST /atoken/register_atoken).
 */
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))

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

const cleanverse = loadEnv(resolve('/home/sati/Desktop/cleanverse.env'))
const keys = loadEnv(resolve(root, 'clearnote.keys.env'))
const pk = keys.WALLET_A_PRIVATE_KEY
if (!pk) {
  console.error('WALLET_A_PRIVATE_KEY missing')
  process.exit(1)
}

const chain = 'monad'
const atokenAddress = deploy.e2e.clinv01
const message = `${chain}${atokenAddress.toLowerCase()}`
const ownerSignature = execSync(`cast wallet sign --private-key ${pk} ${JSON.stringify(message)}`, {
  encoding: 'utf8',
}).trim()

const body = {
  chain,
  atoken_address: atokenAddress,
  owner_signature: ownerSignature,
  atoken_icon: 'https://images.cleanverse.com/app/token_icon/USDC.svg',
}

console.log('register_atoken CLINV01', atokenAddress)
console.log('Note: CLINV01 already ISSUED via atoken/launch — register_atoken is for external contracts only')

const res = await fetch(`${cleanverse.CLEANVERSE_API_BASE}/atoken/register_atoken`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'api-id': cleanverse.CLEANVERSE_API_ID },
  body: JSON.stringify({ data: encryptPayload(body, cleanverse.CLEANVERSE_API_KEY) }),
})
const json = await res.json()
console.log(JSON.stringify(json, null, 2))
process.exit(json.code === '0000' ? 0 : 1)
