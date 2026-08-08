import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateIvms101, ivms101Hash } from '../ivms/generator.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '../../..')

export function buildAuditPack(invoiceId: string) {
  const outDir = resolve(ROOT, 'seed/audit-packs')
  mkdirSync(outDir, { recursive: true })
  const sample = readFileSync(resolve(ROOT, 'seed/samples/invoice-factor-a.xml'), 'utf8')
  const { payload } = generateIvms101({
    originatorName: 'Demo Exporter',
    beneficiaryName: 'Wei Lin',
    originatorAccount: '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB',
    beneficiaryAccount: '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b',
    amountUsd: 5000,
  })
  const ivmsHash = ivms101Hash(payload)
  const pack = {
    invoiceId,
    xml: sample,
    ivms101: payload,
    ivmsHash,
    denialLog: [],
    note: 'Policy hook is STATICCALL — denials logged off-chain via inspect()',
  }
  const json = JSON.stringify(pack, null, 2)
  const packHash = '0x' + createHash('keccak256').update(json).digest('hex')
  const zipPath = resolve(outDir, `${invoiceId}.json`)
  writeFileSync(zipPath, json)
  return { packHash, path: zipPath }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] ?? 'INV-001'
  const r = buildAuditPack(id)
  console.log(JSON.stringify(r, null, 2))
}
