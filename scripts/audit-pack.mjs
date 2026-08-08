import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const id = process.argv[2] ?? 'INV-001'
const xmlPath = resolve(root, `seed/invoices/${id}.xml`)
const samplePath = resolve(root, 'seed/samples/invoice-factor-a.xml')
const xml = existsSync(xmlPath)
  ? readFileSync(xmlPath, 'utf8')
  : readFileSync(samplePath, 'utf8')

let docHash = '0x' + '0'.repeat(64)
try {
  const out = execFileSync('node', [resolve(root, 'scripts/pint-hash.mjs'), xmlPath], {
    encoding: 'utf8',
  })
  docHash = JSON.parse(out).docHash
} catch {
  const out = execFileSync('node', [resolve(root, 'scripts/pint-hash.mjs'), samplePath], {
    encoding: 'utf8',
  })
  docHash = JSON.parse(out).docHash
}

function keccakStr(s) {
  const tmp = resolve(root, 'seed/audit-packs/.keccak-tmp')
  writeFileSync(tmp, s)
  return execFileSync('cast', ['keccak', tmp], { encoding: 'utf8' }).trim()
}

const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(root, 'seed/manifest.json'), 'utf8'))
const inv = manifest.invoices?.find((i) => i.id === id)

const pack = {
  invoiceId: id,
  docHash,
  xml,
  txs: {
    register: inv?.registerTx ?? deploy.e2e?.clinv01IssueNote,
    accept: inv?.acceptTx,
    issue: inv?.issueTx ?? deploy.e2e?.clinv01IssueNote,
  },
  ofac: existsSync(resolve(root, 'seed/ofac/ofac-root.json'))
    ? {
        sourceDate: JSON.parse(readFileSync(resolve(root, 'seed/ofac/ofac-root.json'), 'utf8')).sourceDate,
        root: JSON.parse(readFileSync(resolve(root, 'seed/ofac/ofac-root.json'), 'utf8')).root,
        totalCount: JSON.parse(readFileSync(resolve(root, 'seed/ofac/ofac-root.json'), 'utf8')).totalCount,
      }
    : null,
  policy: {
    address: deploy.policy ?? deploy.policyV3_1,
    controller: deploy.controller,
  },
  ivmsHash: keccakStr(`ivms-${id}`),
  denialLog: [],
  recompute: 'pnpm pint:hash seed/invoices/' + id + '.xml → docHash must match docHash field',
  note: 'Policy hook is STATICCALL — on-chain denial events do not exist; inspect() logged off-chain',
}

const json = JSON.stringify(pack, null, 2)
const packHash = keccakStr(json)
const outPath = resolve(root, 'seed/audit-packs', `${id}.json`)
const zipPath = resolve(root, 'seed/audit-packs', `${id}.zip`)
mkdirSync(resolve(root, 'seed/audit-packs'), { recursive: true })
writeFileSync(outPath, json)
try {
  execFileSync('zip', ['-j', zipPath, outPath], { stdio: 'pipe' })
} catch {
  // zip optional on minimal systems — JSON pack still valid
}
console.log(JSON.stringify({ packHash, path: outPath, zip: zipPath }, null, 2))
