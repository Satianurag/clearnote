import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cli = resolve(root, 'services/src/pint/cli.ts')

function hashFile(path: string) {
  const out = execFileSync('node', ['--experimental-strip-types', cli, path], { encoding: 'utf8' })
  return JSON.parse(out).docHash
}

const a = resolve(root, 'seed/samples/invoice-factor-a.xml')
const b = resolve(root, 'seed/samples/invoice-factor-b.xml')

const hashA = hashFile(a)
const hashB = hashFile(b)
if (hashA !== hashB) {
  console.error('FAIL same_invoice_different_factor', hashA, hashB)
  process.exit(1)
}
console.log('PASS same_invoice_different_factor_same_hash', hashA)

const mutated = readFileSync(a, 'utf8').replace('100000.00', '200000.00')
const tmp = resolve(root, 'seed/samples/.tmp-mutated.xml')
write(mutated, tmp)
if (hashFile(tmp) === hashA) {
  console.error('FAIL different_amount_different_hash')
  process.exit(1)
}
console.log('PASS different_amount_different_hash')

function write(s, p) {
  import('node:fs').then((fs) => fs.writeFileSync(p, s))
}
