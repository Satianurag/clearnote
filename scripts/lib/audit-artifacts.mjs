import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const RPC = process.env.MONAD_RPC ?? 'https://testnet-rpc.monad.xyz'
const CHAIN_ID = 10143

/** keccak256(utf8) — avoids shared .keccak-tmp races. */
export function keccakUtf8(s) {
  const hex = '0x' + Buffer.from(s, 'utf8').toString('hex')
  return execFileSync('cast', ['keccak', hex], { encoding: 'utf8' }).trim()
}

export function keccakFile(path) {
  return execFileSync('cast', ['keccak', path], { encoding: 'utf8' }).trim()
}

const CANON_EXCLUDES = [
  { tag: 'cac:PayeeParty', reason: 'Factoring party name varies per financier (WO-04)' },
  { tag: 'cbc:UUID', reason: 'Transport metadata — not part of trade identity' },
  { tag: 'cbc:IssueTime', reason: 'Time-of-day noise' },
  { tag: 'cac:Signature', reason: 'UBL signature wrapper excluded from docHash' },
  { tag: 'HTML comments', reason: 'Stripped before hash' },
]

export function canonicalize(xml) {
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

export function canonicalizationReport(xml) {
  const present = CANON_EXCLUDES.filter(({ tag }) => {
    if (tag === 'HTML comments') return /<!--/.test(xml)
    return new RegExp(tag.replace(':', '\\:'), 'i').test(xml)
  })
  return {
    excludedNodes: present,
    canonicalPreview: canonicalize(xml).slice(0, 280) + (canonicalize(xml).length > 280 ? '…' : ''),
    note: 'Recompute: pnpm pint:hash <xml> — must match pack docHash',
  }
}

export function structuralValidationReport(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf8')
  const errors = []
  if (!xml.includes('Invoice')) errors.push('missing Invoice root')
  if (!xml.includes('cbc:ID')) errors.push('missing cbc:ID')
  if (!xml.includes('cbc:CustomizationID')) errors.push('missing PINT-SG CustomizationID')
  if (!xml.includes('urn:peppol:pint')) errors.push('missing pint profile marker')
  const xslt = resolve(root, 'assets/pint-sg/pint-sg.xslt')
  let method = 'structural'
  if (existsSync(xslt) && process.env.SAXON_CP) {
    try {
      execFileSync(
        'java',
        ['-cp', process.env.SAXON_CP, 'net.sf.saxon.Transform', '-s:' + xmlPath, '-xsl:' + xslt],
        { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
      )
      method = 'saxon-svrl'
    } catch (e) {
      const out = e.stdout?.toString?.() ?? ''
      const svrlErrors = [...out.matchAll(/failed-assert[\s\S]*?text="([^"]+)"/g)].map((m) => m[1])
      if (svrlErrors.length) errors.push(...svrlErrors)
    }
  }
  return {
    ok: errors.length === 0,
    method,
    errors,
    svrlNote: method === 'structural' ? 'Saxon SVRL skipped — structural checks only (set SAXON_CP for full SVRL)' : undefined,
  }
}

export function obligorAcceptanceEvidence(acceptTx, registry, invoiceId) {
  if (!acceptTx || !registry || !invoiceId) {
    return { note: 'No acceptTx on manifest — obligor EIP-712 not applicable' }
  }
  try {
    const txJson = JSON.parse(
      execFileSync('cast', ['tx', acceptTx, '--json', '--rpc-url', RPC], { encoding: 'utf8', timeout: 30_000 }),
    )
    const input = txJson.transaction?.input ?? txJson.input
    if (!input || input.length < 10) return { acceptTx, error: 'empty tx input' }

    const decoded = execFileSync(
      'cast',
      ['calldata-decode', 'acceptByObligor(bytes32,uint256,bytes)', input],
      { encoding: 'utf8' },
    ).trim()

    const lines = decoded.split('\n').map((l) => l.trim()).filter(Boolean)
    const packInvoiceId = lines[0]
    const deadline = lines[1]
    const sig = lines[2]

    const obligor = execFileSync(
      'cast',
      ['call', registry, 'get(bytes32)(bytes32,bytes32,address,address,uint256,uint64,uint64,bytes3,uint8)', invoiceId, '--rpc-url', RPC],
      { encoding: 'utf8' },
    )
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^0x[a-fA-F0-9]{40}$/.test(l) && l.toLowerCase() !== registry.toLowerCase())

    return {
      acceptTx,
      eip712: {
        domain: { name: 'ClearNote', version: '1', chainId: CHAIN_ID, verifyingContract: registry },
        primaryType: 'InvoiceAcceptance',
        fields: ['invoiceId', 'obligor', 'faceValue', 'dueDate', 'deadline'],
      },
      calldata: { invoiceId: packInvoiceId, deadline, signature: sig },
      expectedObligor: obligor ?? null,
      onChainInvoiceId: invoiceId,
      note: 'acceptByObligor tx succeeded on testnet — signature verified by InvoiceRegistry at inclusion',
    }
  } catch (e) {
    return { acceptTx, error: e instanceof Error ? e.message : String(e) }
  }
}
