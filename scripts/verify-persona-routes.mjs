#!/usr/bin/env node
/**
 * Unit checks for persona route access rules (no server required).
 * Usage: node scripts/verify-persona-routes.mjs
 */
import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'app')
const tmp = resolve(appRoot, '.persona-routes-check.ts')

const script = `import { canAccessRoute, personaHomePath } from './lib/persona-routes.ts'

const cases: Array<[string | null, string, string | null, boolean]> = [
  ['exporter', '/exporter', null, true],
  ['exporter', '/obligor', null, true],
  ['exporter', '/investor', null, false],
  ['exporter', '/compliance', null, false],
  ['exporter', '/compliance/matrix', null, false],
  ['exporter', '/activity', null, false],
  ['investor', '/investor', null, true],
  ['investor', '/compliance/matrix', null, false],
  ['investor', '/activity', null, false],
  ['investor', '/compliance', 'regulator', false],
  ['investor', '/exporter', null, false],
  ['compliance', '/compliance', null, true],
  ['compliance', '/compliance', 'regulator', true],
  ['compliance', '/compliance/matrix', null, true],
  ['compliance', '/activity', null, true],
  ['compliance', '/investor', null, false],
  [null, '/dashboard', null, false],
  ['exporter', '/dashboard', null, true],
  ['investor', '/debug/transfers', null, true],
  ['compliance', '/debug/transfers', null, false],
  ['exporter', '/debug/transfers', null, true],
]

let ok = 0
for (const [persona, path, tab, expected] of cases) {
  const got = canAccessRoute(persona as 'exporter' | 'investor' | 'compliance' | null, path, tab)
  if (got !== expected) {
    throw new Error(\`canAccessRoute(\${persona}, \${path}, \${tab}) = \${got}, expected \${expected}\`)
  }
  ok++
}

if (personaHomePath('exporter') !== '/exporter') throw new Error('exporter home')
if (personaHomePath('investor') !== '/investor') throw new Error('investor home')
if (personaHomePath('compliance') !== '/compliance') throw new Error('compliance home')

console.log(\`PASS persona-routes (\${ok} cases + home paths)\`)
`

writeFileSync(tmp, script)
try {
  execSync(`npx --yes tsx "${tmp}"`, { cwd: appRoot, stdio: 'inherit', timeout: 120_000 })
} finally {
  try {
    unlinkSync(tmp)
  } catch {
    // ignore
  }
}
