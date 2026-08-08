import { readFileSync } from 'node:fs'
import { canonicalize } from './canonicalize.js'
import { docHashFromXml, pintProfileHash as profileHash } from './hash.js'
import { validatePintXml } from './validate.js'

export function hashInvoiceFile(path: string) {
  const xml = readFileSync(path, 'utf8')
  const validation = validatePintXml(path)
  const { excluded } = canonicalize(xml)
  const docHash = docHashFromXml(xml)
  const profileMatch = xml.match(/profileID="([^"]+)"/)
  const customMatch = xml.match(/customizationID="([^"]+)"/)
  const pintProfileHashVal =
    profileMatch && customMatch ? profileHash(profileMatch[1], customMatch[1]) : '0x' + '0'.repeat(64)
  return { docHash, pintProfileHash: pintProfileHashVal, validation, excluded }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2]
  if (!path) {
    console.error('usage: pint:hash <file.xml>')
    process.exit(1)
  }
  const r = hashInvoiceFile(path)
  console.log(JSON.stringify(r, null, 2))
}
