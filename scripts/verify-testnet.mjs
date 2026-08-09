#!/usr/bin/env node
/** Real testnet verification — RPC + on-chain reads (no mocks). */
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RPC = process.env.MONAD_RPC ?? 'https://testnet-rpc.monad.xyz'
const BASE = process.env.BASE_URL?.trim() || 'http://localhost:3000'
const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))

const checks = []
const pass = (n) => { checks.push({ n, ok: true }); console.log(`PASS  ${n}`) }
const fail = (n, d) => { checks.push({ n, ok: false, d }); console.error(`FAIL  ${n}: ${d}`) }

async function get(path, opts) {
  const res = await fetch(`${BASE}${path}`, { ...opts, signal: AbortSignal.timeout(120_000) })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { throw new Error(`${path} non-JSON ${res.status}`) }
  return { res, json }
}

function castCall(to, sig, ...args) {
  return execFileSync('cast', ['call', to, sig, ...args, '--rpc-url', RPC], { encoding: 'utf8', timeout: 30_000 }).trim()
}

async function main() {
  console.log(`Testnet verify RPC=${RPC} APP=${BASE}\n`)

  try {
    const chain = execFileSync('cast', ['chain-id', '--rpc-url', RPC], { encoding: 'utf8' }).trim()
    if (Number(chain) !== 10143) throw new Error(`chainId ${chain}`)
    pass('monad testnet chainId 10143')
  } catch (e) { fail('monad testnet chainId 10143', e.message) }

  try {
    const policy = deploy.policy
    const token = deploy.e2e.clinv01
    const from = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
    const frozen = '0x052eF2f1ce92245E264785ab99A1e7114c809534'
    const out = execFileSync('cast', [
      'call', policy,
      'inspect(address,address,address,uint256)(bool,bytes4,string)',
      token, from, frozen, '1000000000000000000', '--rpc-url', RPC,
    ], { encoding: 'utf8' })
    if (!out.startsWith('false')) throw new Error('expected frozen deny')
    if (!out.includes('0x322fde89')) throw new Error('missing frozen selector')
    pass('live inspect() frozen wallet (testnet)')
  } catch (e) { fail('live inspect() frozen wallet (testnet)', e.message) }

  try {
    const anchor = deploy.auditAnchor
    const count = Number(castCall(anchor, 'anchorCount()(uint256)'))
    if (count < 1) throw new Error('no anchors')
    const packPath = resolve(root, 'seed/audit-packs/INV-001.json')
    if (!existsSync(packPath)) throw new Error('INV-001.json missing')
    const fileHash = execFileSync('cast', ['keccak', packPath], { encoding: 'utf8' }).trim().toLowerCase()
    let matched = false
    for (let i = 0; i < count; i++) {
      const raw = castCall(anchor, 'anchors(uint256)(bytes32,string,uint64,uint64,uint64)', String(i))
      const onChainHash = raw.split('\n')[0].trim().toLowerCase()
      if (onChainHash === fileHash) matched = true
    }
    if (!matched) throw new Error(`no on-chain anchor for file hash ${fileHash.slice(0, 14)}…`)
    pass('INV-001 packHash matches on-chain AuditAnchor')
  } catch (e) { fail('INV-001 packHash matches on-chain AuditAnchor', e.message) }

  try {
    const dir = resolve(root, 'seed/audit-packs')
    const packs = readdirSync(dir).filter((f) => /^INV-\d+\.json$/.test(f))
    pass(`audit packs on disk (${packs.length})`)
  } catch (e) { fail('audit packs on disk', e.message) }

  try {
    const { res, json } = await get('/api/health')
    if (!res.ok || !json.services?.ofac?.rootMatches) throw new Error('health/ofac')
    pass('app /api/health + OFAC')
  } catch (e) { fail('app /api/health + OFAC', e.message) }

  try {
    const { res, json } = await get('/api/audit/anchor')
    if (!res.ok || !json.anchors?.length) throw new Error('no anchors from API')
    const inv001 = json.packs?.find((p) => p.packId === 'INV-001')
    if (!inv001?.anchored) throw new Error('INV-001 not marked anchored')
    pass('app /api/audit/anchor')
  } catch (e) { fail('app /api/audit/anchor', e.message) }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} testnet checks passed`)
  if (failed.length) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
