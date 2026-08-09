#!/usr/bin/env node
/**
 * Build audit pack JSON + ZIP for one invoice (WO-12).
 * Usage: node scripts/audit-pack.mjs INV-001
 *        node scripts/audit-pack.mjs --all
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { generateIvms101 } from './lib/ivms.mjs'
import { captureDenialLog } from './lib/inspect-denials.mjs'
import {
  canonicalizationReport,
  structuralValidationReport,
  obligorAcceptanceEvidence,
  keccakUtf8,
  keccakFile,
} from './lib/audit-artifacts.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let denialCache = null
function getDenialLog() {
  if (!denialCache) denialCache = captureDenialLog()
  return denialCache
}

function loadManifest() {
  return JSON.parse(readFileSync(resolve(root, 'seed/manifest.json'), 'utf8'))
}

function packableIds(manifest) {
  return (manifest.invoices ?? [])
    .filter((inv) => inv.id && /^INV-\d+$/.test(inv.id) && inv.file && existsSync(resolve(root, inv.file)))
    .map((inv) => inv.id)
}

function docHashForInvoice(id) {
  const xmlPath = resolve(root, `seed/invoices/${id}.xml`)
  const samplePath = resolve(root, 'seed/samples/invoice-factor-a.xml')
  const path = existsSync(xmlPath) ? xmlPath : samplePath
  const out = execFileSync('node', [resolve(root, 'scripts/pint-hash.mjs'), path], { encoding: 'utf8' })
  return { docHash: JSON.parse(out).docHash, xmlPath: path }
}

export function buildAuditPack(id, opts = {}) {
  const { docHash, xmlPath } = docHashForInvoice(id)
  const xml = readFileSync(xmlPath, 'utf8')

  const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))
  const manifest = loadManifest()
  const inv = manifest.invoices?.find((i) => i.id === id)
  const wallets = manifest.wallets ?? {}

  const { payload: ivms101, travelRuleRequired } = generateIvms101({
    originatorName: 'ClearNote Originator Ltd',
    beneficiaryName: 'Demo Investor',
    originatorAccount: wallets.A ?? '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB',
    beneficiaryAccount: inv?.financeTarget ?? wallets.B ?? '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b',
    amount: 100000,
    currency: 'SGD',
  })

  const ivmsHash = keccakUtf8(JSON.stringify(ivms101))
  const denialLog = opts.denialLog ?? getDenialLog()
  const anchorTx = deploy.e2e?.[`auditAnchor_${id}`] ?? null
  const registry = deploy.registry

  const pack = {
    invoiceId: id,
    onChainInvoiceId: inv?.invoiceId ?? null,
    docHash,
    xml,
    canonicalization: canonicalizationReport(xml),
    validation: structuralValidationReport(xmlPath),
    obligorAcceptance: obligorAcceptanceEvidence(inv?.acceptTx, registry, inv?.invoiceId),
    txs: {
      register: inv?.registerTx ?? null,
      accept: inv?.acceptTx ?? null,
      issue: inv?.issueTx ?? null,
    },
    ofac: existsSync(resolve(root, 'seed/ofac/ofac-root.json'))
      ? JSON.parse(readFileSync(resolve(root, 'seed/ofac/ofac-root.json'), 'utf8'))
      : null,
    policy: {
      address: deploy.policy ?? deploy.policyV3_1,
      controller: deploy.controller,
    },
    ivms101,
    ivmsHash,
    travelRuleRequired,
    denialLog,
    anchorTx,
    recompute: `pnpm pint:hash seed/invoices/${id}.xml → docHash must match docHash field`,
    note: 'Policy hook is STATICCALL — on-chain denial events do not exist; inspect() logged off-chain in denialLog[]',
  }

  const json = JSON.stringify(pack, null, 2)
  const outDir = resolve(root, 'seed/audit-packs')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, `${id}.json`)
  const zipPath = resolve(outDir, `${id}.zip`)
  const readmePath = resolve(outDir, `${id}-README.txt`)
  const canonPath = resolve(outDir, `${id}-canonicalization.json`)
  const validationPath = resolve(outDir, `${id}-validation.json`)

  writeFileSync(outPath, json)
  writeFileSync(canonPath, JSON.stringify(pack.canonicalization, null, 2))
  writeFileSync(validationPath, JSON.stringify(pack.validation, null, 2))

  const packHash = keccakFile(outPath)

  const readme = `ClearNote audit pack — ${id}
packHash (keccak256 of JSON): ${packHash}
docHash: ${docHash}
ivmsHash: ${ivmsHash}
travelRuleRequired: ${travelRuleRequired}

Recompute docHash:
  pnpm pint:hash seed/invoices/${id}.xml

Verify JSON integrity:
  cast keccak seed/audit-packs/${id}.json

Anchor on-chain (Safe admin):
  pnpm audit:anchor ${id}

ZIP contents:
  - ${id}.json — full manifest
  - ${id}-README.txt — this file
  - ${id}-canonicalization.json — excluded nodes + preview
  - ${id}-validation.json — structural / SVRL validation report

Privacy: only packHash on-chain (AuditAnchor). PII in IVMS101 stays off-chain.
`
  writeFileSync(readmePath, readme)

  try {
    execFileSync(
      'zip',
      ['-j', zipPath, outPath, readmePath, canonPath, validationPath],
      { stdio: 'pipe' },
    )
  } catch {
    // zip optional
  }

  return { packHash, path: outPath, zip: zipPath, denialCount: denialLog.length }
}

const arg = process.argv[2] ?? 'INV-001'
if (arg === '--all') {
  const ids = packableIds(loadManifest())
  const results = []
  for (const id of ids) {
    results.push({ id, ...buildAuditPack(id) })
  }
  console.log(JSON.stringify({ count: results.length, packs: results }, null, 2))
} else {
  console.log(JSON.stringify(buildAuditPack(arg), null, 2))
}
