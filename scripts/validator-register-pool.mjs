#!/usr/bin/env node
/**
 * Register an Ownable compliance pool with Cleanverse Validator (POST /validator/register).
 * Usage: node scripts/validator-register-pool.mjs <poolAddress>
 */
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))
const poolAddress =
  process.argv[2] ?? deploy.compliancePool ?? deploy.e2e?.compliancePool
if (!poolAddress) {
  console.error('Usage: validator-register-pool.mjs [poolAddress]')
  process.exit(1)
}

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
const keys = loadEnv(resolve(root, 'clearnote.keys.env'))
const pk = keys.WALLET_A_PRIVATE_KEY

const chain = 'monad'
const message = `${chain}${poolAddress.toLowerCase()}`
const ownerSignature = execSync(`cast wallet sign --private-key ${pk} ${JSON.stringify(message)}`, {
  encoding: 'utf8',
}).trim()

const body = {
  chain,
  contract_address: poolAddress,
  rule: {
    allowed_group: '',
    allowed_sub_group: '',
    min_tier: 0,
    min_sub_tier: 0,
    is_black_list: false,
    countries: [],
  },
  owner_signature: ownerSignature,
}

console.log('Registering pool', poolAddress)
console.log('message:', message)

const res = await fetch(`${cleanverse.CLEANVERSE_API_BASE}/validator/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'api-id': cleanverse.CLEANVERSE_API_ID },
  body: JSON.stringify({ data: encryptPayload(body, cleanverse.CLEANVERSE_API_KEY) }),
})
const json = await res.json()
console.log(JSON.stringify(json, null, 2))

if (json.code !== '0000') process.exit(1)

const reg = await fetch(`${cleanverse.CLEANVERSE_API_BASE}/validator/is_register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'api-id': cleanverse.CLEANVERSE_API_ID },
  body: JSON.stringify({ chain, contract_address: poolAddress }),
})
const regJson = await reg.json()
console.log('is_register:', JSON.stringify(regJson, null, 2))

const B = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
const verify = await fetch(`${cleanverse.CLEANVERSE_API_BASE}/validator/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'api-id': cleanverse.CLEANVERSE_API_ID },
  body: JSON.stringify({ chain, contract_address: poolAddress, user_address: B }),
})
const verifyJson = await verify.json()
console.log('verify:', JSON.stringify(verifyJson, null, 2))

process.exit(regJson?.data?.registered ? 0 : 1)
