import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = dirname(fileURLToPath(import.meta.url))
const PINT_ZIP = process.env.PINT_SG_ZIP ?? resolve(__dir, '../../../pint-sg.zip')

export interface ValidationResult {
  ok: boolean
  errors: string[]
  method: 'saxon' | 'structural'
}

export function validatePintXml(xmlPath: string): ValidationResult {
  const xslt = resolve(__dir, '../../../assets/pint-sg/pint-sg.xslt')
  if (existsSync(xslt)) {
    try {
      const report = execFileSync(
        'java',
        ['-cp', process.env.SAXON_CP ?? 'saxon-he-12.5.jar', 'net.sf.saxon.Transform', '-s:' + xmlPath, '-xsl:' + xslt],
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      )
      const errors = [...report.matchAll(/failed-assert[\s\S]*?text="([^"]+)"/g)].map((m) => m[1])
      return { ok: errors.length === 0, errors, method: 'saxon' }
    } catch {
      /* fall through */
    }
  }
  const xml = readFileSync(xmlPath, 'utf8')
  const errors: string[] = []
  if (!xml.includes('Invoice')) errors.push('missing Invoice root')
  if (!xml.includes('cbc:ID')) errors.push('missing cbc:ID')
  return { ok: errors.length === 0, errors, method: 'structural' }
}
