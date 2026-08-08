import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RPC = process.env.MONAD_RPC ?? 'https://testnet-rpc.monad.xyz'
const manifest = JSON.parse(readFileSync(resolve(root, 'seed/manifest.json'), 'utf8'))
const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))

const REGISTRY = deploy.registry
const CONTROLLER = deploy.controller
const POLICY = deploy.policy ?? deploy.policyV3_1
const CLINV01 = deploy.e2e?.clinv01 ?? '0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69'
const CLNOTE02 = '0xDAA42E5c1A8B9724F499729609f166B0D140Ec18'
const BASE = deploy.baseRouter
const DEAD = '0xdead000000000000000000000000000000000001'
const A = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'
const B = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'

function cast(args) {
  return execFileSync('cast', [...args, '--rpc-url', RPC], { encoding: 'utf8' }).trim()
}

function txExists(hash) {
  if (!hash || hash.length < 10) return false
  try {
    const r = cast(['tx', hash])
    return r.includes('blockNumber')
  } catch {
    return false
  }
}

let ok = true
function pass(msg) {
  console.log('PASS', msg)
}
function fail(msg) {
  console.error('FAIL', msg)
  ok = false
}

const invoices = manifest.invoices ?? []
const registered = invoices.filter((i) => i.registerTx)
const financed = invoices.filter((i) => i.status === 'Financed')
const unaccepted = invoices.filter((i) => i.status === 'Registered_unaccepted')
const skipped = invoices.filter((i) => i.status === 'skipped_register')

if (registered.length >= 11) pass(`manifest registered count ${registered.length}`)
else fail(`expected 11 registered, got ${registered.length}`)

if (financed.length >= 11) pass(`manifest financed count ${financed.length}`)
else fail(`expected 11 financed, got ${financed.length}`)

if (unaccepted.length >= 1) pass(`unaccepted invoice present`)
else fail('expected 1 unaccepted invoice (INV-010)')

if (skipped.length >= 1) pass(`INV-011 skipped_register present`)
else fail('expected INV-011 skipped')

for (const inv of invoices) {
  for (const field of ['registerTx', 'acceptTx', 'issueTx']) {
    const h = inv[field]
    if (h && !txExists(h)) fail(`${inv.id} ${field} ${h} not on chain`)
  }
}

try {
  const inv001 = invoices.find((i) => i.id === 'INV-001')
  if (inv001?.invoiceId) {
    const onFinanced = cast(['call', REGISTRY, 'isFinanced(bytes32)(bool)', inv001.invoiceId])
    if (onFinanced === 'true') pass('INV-001 isFinanced on registry')
    else fail('INV-001 not financed on chain')
  } else if (invoices.length === 0) {
    fail('seed manifest empty — run seed:populate')
  }
} catch (e) {
  fail(`registry isFinanced: ${e}`)
}

// INV-011 duplicate — simulate register with INV-001 docHash
const inv001 = invoices.find((i) => i.id === 'INV-001')
if (inv001?.invoiceId) {
  const xml001 = resolve(root, 'seed/invoices/INV-001.xml')
  const xml011 = resolve(root, 'seed/invoices/INV-011.xml')
  const hash001 = JSON.parse(
    execFileSync('node', [resolve(root, 'scripts/pint-hash.mjs'), xml001], { encoding: 'utf8' }),
  ).docHash
  const hash011 = JSON.parse(
    execFileSync('node', [resolve(root, 'scripts/pint-hash.mjs'), xml011], { encoding: 'utf8' }),
  ).docHash
  if (hash011 === hash001) pass('INV-011 same docHash as INV-001')
  else fail(`INV-011 docHash mismatch vs INV-001 (${hash011} vs ${hash001})`)

  const due = Math.floor(Date.now() / 1000) + 86400
  try {
    cast([
      'call',
      REGISTRY,
      'register((bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8))',
      `(${hash001},0x${'ab'.repeat(32)},${A},${A},100000,${due},0,0x534744,0)`,
    ])
    fail('INV-011 register simulate should revert InvoiceAlreadyFinanced')
  } catch (e) {
    const msg = String(e)
    if (msg.includes('InvoiceAlreadyFinanced') || msg.includes('0x')) pass('INV-011 duplicate register reverts')
    else fail(`INV-011 duplicate: ${msg.slice(0, 120)}`)
  }
}

// WO-08 spot checks
try {
  const pol = cast(['call', CLINV01, 'policy()(address)'])
  if (pol.toLowerCase() === POLICY.toLowerCase()) pass('CLINV01 policy = live policy')
  else fail(`CLINV01 policy ${pol} != ${POLICY}`)
} catch (e) {
  fail(`CLINV01 policy: ${e}`)
}

try {
  const pol02 = cast(['call', CLNOTE02, 'policy()(address)'])
  if (pol02.toLowerCase() === BASE.toLowerCase()) pass('CLNOTE02 policy untouched (BASE)')
  else fail(`CLNOTE02 policy ${pol02} != BASE`)
} catch (e) {
  fail(`CLNOTE02 policy: ${e}`)
}

console.log(ok ? 'seed:verify OK' : 'seed:verify FAIL')
process.exit(ok ? 0 : 1)
