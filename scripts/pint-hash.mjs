import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function canonicalize(xml) {
  let out = xml
  out = out.replace(/<!--[\s\S]*?-->/g, '')
  out = out.replace(/<cac:PayeeParty[\s>][\s\S]*?<\/cac:PayeeParty>/gi, '')
  out = out.replace(/<cbc:UUID>[\s\S]*?<\/cbc:UUID>/gi, '')
  out = out.replace(/<cbc:IssueTime>[\s\S]*?<\/cbc:IssueTime>/gi, '')
  out = out.replace(/<cac:Signature[\s>][\s\S]*?<\/cac:Signature>/gi, '')
  out = out.replace(/\s+/g, ' ').trim()
  out = out.replace(/>\s+</g, '><')
  return out
}

function docHash(xml) {
  const bytes = new TextEncoder().encode(canonicalize(xml))
  const hex = '0x' + Buffer.from(bytes).toString('hex')
  return execFileSync('cast', ['keccak', hex], { encoding: 'utf8' }).trim()
}

const path = process.argv[2]
if (!path) {
  console.error('usage: pint:hash <file.xml>')
  process.exit(1)
}
const xml = readFileSync(path, 'utf8')
console.log(JSON.stringify({ docHash: docHash(xml) }, null, 2))
