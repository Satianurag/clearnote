import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function hashFile(path) {
  const out = execFileSync('node', [resolve(root, 'scripts/pint-hash.mjs'), path], { encoding: 'utf8' })
  return JSON.parse(out).docHash
}

function hashXml(xml) {
  const tmp = resolve(root, 'seed/samples/.tmp-pint-test.xml')
  writeFileSync(tmp, xml)
  return hashFile(tmp)
}

const a = resolve(root, 'seed/samples/invoice-factor-a.xml')
const b = resolve(root, 'seed/samples/invoice-factor-b.xml')
const xmlA = readFileSync(a, 'utf8')

// validates_real_pint_sg_sample — structural sample passes canonical hash
const hashA = hashFile(a)
if (!/^0x[a-fA-F0-9]{64}$/.test(hashA)) {
  console.error('FAIL validates_real_pint_sg_sample bad hash', hashA)
  process.exit(1)
}
console.log('PASS validates_real_pint_sg_sample', hashA)

// rejects_invalid_invoice — remove mandatory ID → different docHash
const broken = xmlA.replace(/<cbc:ID>[\s\S]*?<\/cbc:ID>/i, '')
const brokenHash = hashXml(broken)
if (brokenHash === hashA) {
  console.error('FAIL rejects_invalid_invoice same hash')
  process.exit(1)
}
console.log('PASS rejects_invalid_invoice', brokenHash)

// same_invoice_different_factor_same_hash
const hashB = hashFile(b)
if (hashA !== hashB) {
  console.error('FAIL same_invoice_different_factor', hashA, hashB)
  process.exit(1)
}
console.log('PASS same_invoice_different_factor_same_hash', hashA)

// different_amount_different_hash
const mutated = xmlA.replace('100000.00', '200000.00')
if (hashXml(mutated) === hashA) {
  console.error('FAIL different_amount_different_hash')
  process.exit(1)
}
console.log('PASS different_amount_different_hash')

// deterministic_across_reformatting
const reformatted = xmlA.replace(/>\s+</g, '><').replace(/\n/g, '  \n')
if (hashXml(reformatted) !== hashA) {
  console.error('FAIL deterministic_across_reformatting')
  process.exit(1)
}
console.log('PASS deterministic_across_reformatting')

console.log('pint:test ALL PASS (5 checks)')
