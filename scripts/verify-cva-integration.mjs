#!/usr/bin/env node
/**
 * End-to-end CVA integration verification (testnet + Cleanverse sandbox).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const deploy = JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))
const RPC = process.env.MONAD_RPC ?? 'https://testnet-rpc.monad.xyz'
const AUSDC = '0xaC0893567D43C3E7e6e35a72803df05416C1f20D'
const CLINV01 = deploy.e2e.clinv01
const DVP = deploy.dvpEscrow
const POOL = deploy.compliancePool ?? deploy.e2e?.compliancePool
const BASE = deploy.baseRouter

let pass = 0
let fail = 0

function ok(name, detail = '') {
  pass++
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`)
}

function bad(name, detail = '') {
  fail++
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('=== verify:cva — Cleanverse doctor ===')
const doc = spawnSync('node', ['scripts/cleanverse-doctor.mjs'], { cwd: root, stdio: 'inherit' })
if (doc.status !== 0) bad('cleanverse:doctor')
else ok('cleanverse:doctor')

console.log('\n=== verify:cva — on-chain ===')
const ausdcPolicy = execSync(`cast call ${AUSDC} "policy()(address)" --rpc-url ${RPC}`, { encoding: 'utf8' }).trim()
if (ausdcPolicy.toLowerCase() === BASE.toLowerCase()) ok('aUSDC policy = BASE router', ausdcPolicy)
else bad('aUSDC policy', `${ausdcPolicy} != ${BASE}`)

const clinvPolicy = execSync(`cast call ${CLINV01} "policy()(address)" --rpc-url ${RPC}`, { encoding: 'utf8' }).trim()
if (clinvPolicy.toLowerCase() === deploy.policy.toLowerCase()) ok('CLINV01 policy = ClearNotePolicy v3.2')
else bad('CLINV01 policy', clinvPolicy)

const nextOfferId = BigInt(execSync(`cast call ${DVP} "nextOfferId()(uint256)" --rpc-url ${RPC}`, { encoding: 'utf8' }).trim())
if (nextOfferId > 0n) {
  const offerId = nextOfferId - 1n
  const cash = execSync(
    `cast call ${DVP} "offers(uint256)(address,address,address,uint256,uint256,uint64,uint256,bool)" ${offerId} --rpc-url ${RPC}`,
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[2]
    ?.split(/\s+/)[0]
  if (cash?.toLowerCase() === AUSDC.toLowerCase()) ok('latest DvP offer cashToken = aUSDC', `offerId=${offerId}`)
  else bad('latest DvP offer cashToken', cash ?? 'parse error')
} else {
  bad('DvP offers', 'none — run pnpm dvp:post-ausdc-offer')
}

const fillTx = deploy.e2e?.dvpFillAusdc_offer0
if (fillTx) {
  const status = execSync(`cast receipt ${fillTx} status --rpc-url ${RPC}`, { encoding: 'utf8' }).trim()
  const okStatus = status === '1' || status === '(success)' || status === 'true' || status === '1 (success)'
  if (okStatus) ok('DvP aUSDC fill tx succeeded', fillTx)
  else bad('DvP aUSDC fill tx', `status=${status}`)
  const offer0Active = execSync(
    `cast call ${DVP} "offers(uint256)(address,address,address,uint256,uint256,uint64,uint256,bool)" 0 --rpc-url ${RPC}`,
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[7]
    ?.split(/\s+/)[0]
  if (offer0Active === 'false') ok('offer 0 filled and closed')
  else bad('offer 0 state', `active=${offer0Active}`)
} else {
  bad('DvP fill proof', 'missing e2e.dvpFillAusdc_offer0 in deployments')
}

const fill1Tx = deploy.e2e?.dvpFillAusdc_offer1
if (fill1Tx) {
  const status1 = execSync(`cast receipt ${fill1Tx} status --rpc-url ${RPC}`, { encoding: 'utf8' }).trim()
  const ok1 = status1 === '1' || status1 === '(success)' || status1 === 'true' || status1 === '1 (success)'
  if (ok1) ok('DvP aUSDC fill offer1 succeeded', fill1Tx)
  else bad('DvP fill offer1', `status=${status1}`)
  const offer1Active = execSync(
    `cast call ${DVP} "offers(uint256)(address,address,address,uint256,uint256,uint64,uint256,bool)" 1 --rpc-url ${RPC}`,
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')[7]
    ?.split(/\s+/)[0]
  if (offer1Active === 'false') ok('offer 1 filled and closed')
  else bad('offer 1 state', `active=${offer1Active}`)
}

if (POOL) {
  const poolOwner = execSync(`cast call ${POOL} "owner()(address)" --rpc-url ${RPC}`, { encoding: 'utf8' }).trim()
  const deployer = deploy.deployer ?? '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'
  if (poolOwner.toLowerCase() === deployer.toLowerCase()) ok('compliance pool owner = wallet A', POOL)
  else bad('compliance pool owner', `${poolOwner} != ${deployer}`)
  const poolValidator = execSync(`cast call ${POOL} "validator()(address)" --rpc-url ${RPC}`, { encoding: 'utf8' }).trim()
  const expectedValidator = deploy.cleanverseValidator ?? deploy.e2e?.validatorContract
  if (poolValidator.toLowerCase() === expectedValidator.toLowerCase()) ok('compliance pool validator immutable')
  else bad('compliance pool validator', poolValidator)
} else {
  bad('compliance pool', 'missing in deployments/monad-10143.json')
}

console.log('\n=== verify:cva — forge test ===')
const forge = spawnSync(
  'forge',
  ['test', '--match-contract', 'DvPEscrowTest|CleanverseCompliancePoolTest'],
  {
  cwd: resolve(root, 'contracts'),
  stdio: 'inherit',
})
if (forge.status !== 0) bad('DvPEscrow forge tests')
else ok('DvPEscrow forge tests')

console.log(`\n=== verify:cva: ${pass} pass, ${fail} fail ===`)
process.exit(fail > 0 ? 1 : 0)
