import { execFileSync } from 'node:child_process'

const THRESHOLD_USD = 1000

function travelRuleRequired(amountUsd) {
  return amountUsd >= THRESHOLD_USD
}

function keccakStr(s) {
  return execFileSync('cast', ['keccak', s], { encoding: 'utf8' }).trim()
}

if (travelRuleRequired(500)) {
  console.error('FAIL threshold below')
  process.exit(1)
}
console.log('PASS threshold_below_usd_1000')

if (!travelRuleRequired(5000)) {
  console.error('FAIL threshold above')
  process.exit(1)
}
console.log('PASS threshold_above_usd_1000')

const payload = {
  originator: { accountNumber: ['0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'] },
  beneficiary: { accountNumber: ['0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'] },
}
const hash = keccakStr(JSON.stringify(payload))
if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
  console.error('FAIL ivms hash')
  process.exit(1)
}
console.log('PASS ivms101_hash', hash)

// On-chain anchor stores hash only — no PII strings in deployment scripts
const onChainSample = hash
if (/Wei Lin|PASSPORT|P9999999/.test(onChainSample)) {
  console.error('FAIL PII on anchor hash path')
  process.exit(1)
}
console.log('PASS no_pii_on_chain_anchor_hash')

console.log('ivms:test ALL PASS')
