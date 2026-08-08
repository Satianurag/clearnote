import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { addressLeaf, buildMerkle } from './merkle.js'

const __dir = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dir, '../../..')
const SDN_PATH = process.env.SDN_CSV ?? resolve(ROOT, '../sdn.csv')
const DEMO_PATH = resolve(__dir, 'demo-additions.json')
const OUT_DIR = resolve(ROOT, 'seed/ofac')

const ETH_RE = /Digital Currency Address - ETH\s+(0x[a-fA-F0-9]{40})/gi

export interface OfacBuildResult {
  sourceDate: string
  realCount: number
  demoCount: number
  totalCount: number
  root: string
  outDir: string
}

function keccakLeaf(addr: string): string {
  return addressLeaf(addr)
}

export function parseSdnCsv(path: string): string[] {
  const text = readFileSync(path, 'utf8')
  const addrs = new Set<string>()
  for (const m of text.matchAll(ETH_RE)) {
    addrs.add(m[1].toLowerCase())
  }
  return [...addrs]
}

export function loadDemoAdditions(): string[] {
  if (!existsSync(DEMO_PATH)) return []
  const json = JSON.parse(readFileSync(DEMO_PATH, 'utf8')) as { addresses?: string[] }
  return (json.addresses ?? []).map((a) => a.toLowerCase())
}

export function buildOfac(): OfacBuildResult {
  const real = parseSdnCsv(SDN_PATH)
  const demo = loadDemoAdditions()
  const all = [...new Set([...real, ...demo])]
  const leaves = all.map((a) => keccakLeaf(a))
  const { root, proofs } = buildMerkle(leaves)

  mkdirSync(OUT_DIR, { recursive: true })
  const sourceDate = new Date().toISOString().slice(0, 10)
  const out = {
    sourceDate,
    sourceUri: `file://${SDN_PATH}`,
    realCount: real.length,
    demoCount: demo.length,
    totalCount: all.length,
    root,
    addresses: all,
    proofs: Object.fromEntries(all.map((addr) => [addr, proofs.get(keccakLeaf(addr)) ?? []])),
  }
  writeFileSync(resolve(OUT_DIR, 'ofac-root.json'), JSON.stringify(out, null, 2))
  return {
    sourceDate,
    realCount: real.length,
    demoCount: demo.length,
    totalCount: all.length,
    root,
    outDir: OUT_DIR,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = buildOfac()
  console.log(
    `OFAC build: date=${r.sourceDate} real=${r.realCount} demo=${r.demoCount} total=${r.totalCount} root=${r.root}`,
  )
}
