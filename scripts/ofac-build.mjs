import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SDN_PATH = process.env.SDN_CSV ?? resolve(root, '../sdn.csv')
const DEMO_PATH = resolve(root, 'services/src/ofac/demo-additions.json')
const OUT_DIR = resolve(root, 'seed/ofac')
const ETH_RE = /Digital Currency Address - ETH\s+(0x[a-fA-F0-9]{40})/gi

function keccak256(buf) {
  const hex = Buffer.isBuffer(buf) ? '0x' + buf.toString('hex') : buf
  return execFileSync('cast', ['keccak', hex], { encoding: 'utf8' }).trim()
}

function addressLeaf(addr) {
  const bytes = Buffer.from(addr.replace(/^0x/i, ''), 'hex')
  return keccak256(bytes)
}

function hashPair(a, b) {
  const ah = a.replace(/^0x/, '').toLowerCase()
  const bh = b.replace(/^0x/, '').toLowerCase()
  const [left, right] = ah <= bh ? [ah, bh] : [bh, ah]
  return keccak256(Buffer.concat([Buffer.from(left, 'hex'), Buffer.from(right, 'hex')]))
}

function buildMerkle(leaves) {
  if (leaves.length === 0) return { root: '0x' + '0'.repeat(64), proofs: new Map() }
  const sorted = [...leaves].sort((a, b) => a.localeCompare(b))
  const proofs = new Map(sorted.map((l) => [l, []]))
  let layer = sorted
  while (layer.length > 1) {
    const next = []
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1] ?? left
      next.push(hashPair(left, right))
      for (const leaf of sorted) {
        const path = proofs.get(leaf)
        const idx = layer.indexOf(leaf)
        if (idx >= 0) {
          const sib = idx % 2 === 0 ? layer[i + 1] : layer[i]
          if (sib) path.push(sib)
        }
      }
    }
    layer = next
  }
  return { root: layer[0], proofs }
}

const text = readFileSync(SDN_PATH, 'utf8')
const real = [...new Set([...text.matchAll(ETH_RE)].map((m) => m[1].toLowerCase()))]
const demo = existsSync(DEMO_PATH)
  ? JSON.parse(readFileSync(DEMO_PATH, 'utf8')).addresses.map((a) => a.toLowerCase())
  : []
const all = [...new Set([...real, ...demo])]
const leaves = all.map((a) => addressLeaf(a))
const { root: merkleRoot, proofs } = buildMerkle(leaves)
mkdirSync(OUT_DIR, { recursive: true })
const sourceDate = new Date().toISOString().slice(0, 10)
const out = {
  sourceDate,
  sourceUri: `file://${SDN_PATH}`,
  realCount: real.length,
  demoCount: demo.length,
  totalCount: all.length,
  root: merkleRoot,
  addresses: all,
  proofs: Object.fromEntries(all.map((addr) => [addr, proofs.get(addressLeaf(addr)) ?? []])),
}
writeFileSync(resolve(OUT_DIR, 'ofac-root.json'), JSON.stringify(out, null, 2))
console.log(
  `OFAC build: date=${sourceDate} real=${real.length} demo=${demo.length} total=${all.length} root=${merkleRoot}`,
)
