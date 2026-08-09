#!/usr/bin/env node
/**
 * Smoke-check local ClearNote app APIs (no mocks). Requires dev server on BASE_URL.
 * Usage: BASE_URL=http://localhost:3000 node scripts/verify-app-smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = process.env.BASE_URL?.trim() || 'http://localhost:3000'
const WALLET_A = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'
const WALLET_B = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
const SDN = '0x098b716b8aaf21512996dc57eb0615e2383e2f96'

const checks = []

function personaCookie(persona) {
  return `clearnote-persona=${persona}`
}

async function get(path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) }
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, signal: AbortSignal.timeout(120_000) })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error(`${path} returned non-JSON (${res.status}): ${text.slice(0, 120)}`)
  }
  return { res, json }
}

function pass(name) {
  checks.push({ name, ok: true })
  console.log(`PASS  ${name}`)
}

function fail(name, detail) {
  checks.push({ name, ok: false, detail })
  console.error(`FAIL  ${name}: ${detail}`)
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`)

  try {
    const { res, json } = await get('/api/health')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (json.status !== 'ok' && json.status !== 'degraded') throw new Error(`status=${json.status}`)
    if (!json.services?.indexer?.ok) throw new Error('indexer down')
    if (!json.services?.ofac?.rootMatches) throw new Error('OFAC root mismatch')
    pass('health + OFAC root alignment')
  } catch (e) {
    fail('health + OFAC root alignment', e.message)
  }

  try {
    const { res, json } = await get('/api/audit/pack/list', {
      headers: { Cookie: personaCookie('compliance') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!Array.isArray(json.packs) || json.packs.length < 10) throw new Error(`expected >=10 packs, got ${json.packs?.length}`)
    const inv001 = json.meta?.find((m) => m.id === 'INV-001')
    if (!inv001?.hasZip) throw new Error('INV-001 ZIP missing')
    pass(`audit pack list (${json.packs.length} packs + ZIP meta)`)
  } catch (e) {
    fail('audit pack list', e.message)
  }

  try {
    const res = await fetch(`${BASE}/api/audit/pack?id=INV-001&format=zip`, {
      headers: { Cookie: personaCookie('compliance') },
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('zip')) throw new Error(`expected application/zip, got ${ct}`)
    const buf = await res.arrayBuffer()
    if (buf.byteLength < 100) throw new Error('ZIP too small')
    pass('audit pack ZIP download (INV-001)')
  } catch (e) {
    fail('audit pack ZIP download (INV-001)', e.message)
  }

  try {
    const { res } = await get('/api/audit/pack?id=INV-011', {
      headers: { Cookie: personaCookie('compliance') },
    })
    if (res.status !== 404) throw new Error(`expected 404 for skipped invoice, got ${res.status}`)
    pass('audit pack INV-011 returns 404 (skipped_register)')
  } catch (e) {
    fail('audit pack INV-011 returns 404', e.message)
  }

  try {
    const { res, json } = await get('/api/audit/pack?id=INV-002', {
      headers: { Cookie: personaCookie('compliance') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!json.invoiceId) throw new Error('missing invoiceId')
    pass('audit pack INV-002 on disk')
  } catch (e) {
    fail('audit pack INV-002 on disk', e.message)
  }

  try {
    const { res, json } = await get('/api/indexer?op=compliance&limit=5', {
      headers: { Cookie: personaCookie('compliance') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!Array.isArray(json.events)) throw new Error('missing events array')
    pass('indexer compliance events')
  } catch (e) {
    fail('indexer compliance events', e.message)
  }

  try {
    const { res, json } = await get(`/api/dashboard/pending?address=${WALLET_A}`, {
      headers: { Cookie: personaCookie('exporter') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!json.summary || !Array.isArray(json.actions)) throw new Error('invalid shape')
    pass('dashboard pending (wallet A)')
  } catch (e) {
    fail('dashboard pending (wallet A)', e.message)
  }

  try {
    const { res, json } = await get(`/api/investor/positions?holder=${WALLET_B}`, {
      headers: { Cookie: personaCookie('investor') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!Array.isArray(json.positions)) throw new Error('missing positions')
    pass('investor positions (wallet B)')
  } catch (e) {
    fail('investor positions (wallet B)', e.message)
  }

  try {
    const { res, json } = await get('/api/cleanverse/generate-apass', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: personaCookie('investor'),
      },
      body: JSON.stringify({ address: WALLET_B }),
    })
    if (res.status !== 400) throw new Error(`expected 400 without fullName, got ${res.status}`)
    if (!json.error?.includes('fullName')) throw new Error('wrong error message')
    pass('generate-apass rejects missing fullName')
  } catch (e) {
    fail('generate-apass rejects missing fullName', e.message)
  }

  try {
    const { res, json } = await get('/api/ofac/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: personaCookie('compliance'),
      },
      body: JSON.stringify({ address: SDN }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!json.inSeedList || !json.merkleVerified) throw new Error('SDN member should verify')
    pass('ofac verifyInclusion (SDN member)')
  } catch (e) {
    fail('ofac verifyInclusion (SDN member)', e.message)
  }

  try {
    const { res, json } = await get('/api/audit/anchor', {
      headers: { Cookie: personaCookie('compliance') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!Array.isArray(json.anchors)) throw new Error('missing anchors array')
    if (!Array.isArray(json.packs)) throw new Error('missing packs array')
    pass('audit anchor on-chain read')
  } catch (e) {
    fail('audit anchor on-chain read', e.message)
  }

  try {
    const { res, json } = await get('/api/ivms/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: personaCookie('compliance'),
      },
      body: JSON.stringify({
        originatorName: 'Demo Exporter',
        beneficiaryName: 'Wei Lin',
        originatorAccount: WALLET_A,
        beneficiaryAccount: WALLET_B,
        amountUsd: 5000,
      }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!json.ivmsHash || !json.payload) throw new Error('missing ivms payload')
    if (!json.travelRuleRequired) throw new Error('5000 USD should require travel rule')
    pass('ivms101 generate (travel rule)')
  } catch (e) {
    fail('ivms101 generate (travel rule)', e.message)
  }

  try {
    const xml = readFileSync(resolve(root, 'seed/invoices/INV-001.xml'), 'utf8')
    const { res, json } = await get('/api/pint/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: personaCookie('exporter'),
      },
      body: JSON.stringify({ xml }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!json.validation?.ok) throw new Error('INV-001 validation should pass')
    if (!json.docHash?.startsWith('0x')) throw new Error('missing docHash')
    if (typeof json.fields?.faceValue !== 'string') throw new Error('faceValue must be JSON string')
    pass('pint validate INV-001 (no bigint 500)')
  } catch (e) {
    fail('pint validate INV-001 (no bigint 500)', e.message)
  }

  try {
    const { res, json } = await get('/api/compliance/denials', {
      headers: { Cookie: personaCookie('compliance') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!Array.isArray(json.denials)) throw new Error('missing denials array')
    if (json.denials.length < 1) throw new Error('expected at least one live denial scenario')
    pass('compliance live denial log')
  } catch (e) {
    fail('compliance live denial log', e.message)
  }

  try {
    const { res, json } = await get('/api/audit/denial-log', {
      headers: { Cookie: personaCookie('compliance') },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    if (!Array.isArray(json.entries)) throw new Error('missing entries array')
    if (json.entries.length < 1) throw new Error('expected archived denials from INV-001 pack')
    pass('audit pack denial archive API')
  } catch (e) {
    fail('audit pack denial archive API', e.message)
  }

  for (const route of ['/dashboard', '/investor', '/exporter', '/activity', '/compliance']) {
    try {
      const res = await fetch(`${BASE}${route}`, { signal: AbortSignal.timeout(60_000) })
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      pass(`route ${route}`)
    } catch (e) {
      fail(`route ${route}`, e.message)
    }
  }

  const failed = checks.filter((c) => !c.ok)
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`)
  if (failed.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
