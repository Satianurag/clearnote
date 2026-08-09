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

function verifyProof(leaf, proof, root) {
  let computed = leaf
  for (const p of proof) {
    const ah = computed.replace(/^0x/, '').toLowerCase()
    const bh = p.replace(/^0x/, '').toLowerCase()
    computed = ah <= bh ? hashPair(computed, p) : hashPair(p, computed)
  }
  return computed.toLowerCase() === root.toLowerCase()
}

function buildMerkle(leaves) {
  if (leaves.length === 0) return { root: '0x' + '0'.repeat(64), proofs: new Map() }

  const sorted = [...leaves].sort((a, b) => a.localeCompare(b))
  const proofs = new Map(sorted.map((l) => [l, []]))
  let layer = [...sorted]
  // Track each original leaf's index in the current tree layer.
  let positions = sorted.map((_, i) => i)

  while (layer.length > 1) {
    const next = []
    const nextPositions = [...positions]

    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]
      const right = layer[i + 1] ?? left
      const parent = hashPair(left, right)
      const parentIndex = next.length
      next.push(parent)

      for (let leafIdx = 0; leafIdx < sorted.length; leafIdx++) {
        const pos = positions[leafIdx]
        if (pos === i) {
          proofs.get(sorted[leafIdx]).push(layer[i + 1] ?? left)
          nextPositions[leafIdx] = parentIndex
        } else if (pos === i + 1) {
          proofs.get(sorted[leafIdx]).push(layer[i])
          nextPositions[leafIdx] = parentIndex
        }
      }
    }

    layer = next
    positions = nextPositions
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

let failed = 0
for (const addr of all) {
  const leaf = addressLeaf(addr)
  const proof = proofs.get(leaf) ?? []
  if (!verifyProof(leaf, proof, merkleRoot)) {
    console.error(`OFAC proof verify failed for ${addr}`)
    failed++
  }
}
if (failed > 0) {
  console.error(`OFAC build: ${failed} invalid proofs`)
  process.exit(1)
}

console.log(
  `OFAC build: date=${sourceDate} real=${real.length} demo=${demo.length} total=${all.length} root=${merkleRoot}`,
)
