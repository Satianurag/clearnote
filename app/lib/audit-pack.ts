import { existsSync, readdirSync, readFileSync } from 'node:fs'
import type { Hex } from 'viem'
import { resolve } from 'node:path'
import { repoRoot } from '@/lib/repo-root'

export type AuditPack = {
  invoiceId: string
  docHash: string
  xml?: string
  onChainInvoiceId?: string | null
  canonicalization?: Record<string, unknown>
  validation?: { ok: boolean; method: string; errors: string[] }
  obligorAcceptance?: Record<string, unknown>
  txs: Record<string, string | undefined>
  ofac: { sourceDate?: string; root?: string; totalCount?: number } | null
  policy: { address?: string; controller?: string }
  ivms101?: Record<string, unknown>
  ivmsHash?: string
  travelRuleRequired?: boolean
  anchorTx?: string | null
  denialLog: DenialLogEntry[]
  recompute?: string
  note?: string
}

export type DenialLogEntry = {
  scenario?: string
  from?: string
  to?: string
  amount?: string
  ok?: boolean
  selector?: string
  reason?: string
  at?: string
}

type ManifestInvoice = {
  id: string
  invoiceId: string
}

function loadManifest(): { invoices?: ManifestInvoice[] } {
  const path = resolve(repoRoot(), 'seed/manifest.json')
  if (!existsSync(path)) return { invoices: [] }
  return JSON.parse(readFileSync(path, 'utf8')) as { invoices?: ManifestInvoice[] }
}

function resolvePackId(idOrHash: string): string | null {
  const trimmed = idOrHash.trim()
  if (/^INV-\d+$/i.test(trimmed)) return trimmed.toUpperCase()

  const manifest = loadManifest()
  const match = manifest.invoices?.find(
    (inv) =>
      typeof inv.invoiceId === 'string' &&
      inv.invoiceId.toLowerCase() === trimmed.toLowerCase(),
  )
  return match?.id ?? null
}

/** Invoice IDs with a real on-disk audit pack (no synthetic manifest-only stubs). */
export function listAuditPackIds(): string[] {
  const dir = resolve(repoRoot(), 'seed/audit-packs')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => /^INV-\d+\.json$/i.test(name))
    .map((name) => name.replace(/\.json$/i, '').toUpperCase())
    .sort()
}

export type AuditPackMeta = {
  id: string
  hasZip: boolean
}

export function listAuditPackMeta(): AuditPackMeta[] {
  return listAuditPackIds().map((id) => ({
    id,
    hasZip: existsSync(auditPackZipPath(id)),
  }))
}

export function auditPackJsonPath(packId: string): string {
  return resolve(repoRoot(), `seed/audit-packs/${packId.toUpperCase()}.json`)
}

export function auditPackZipPath(packId: string): string {
  return resolve(repoRoot(), `seed/audit-packs/${packId.toUpperCase()}.zip`)
}

export function auditPackReadmePath(packId: string): string {
  return resolve(repoRoot(), `seed/audit-packs/${packId.toUpperCase()}-README.txt`)
}

/** Canonical packHash from build-time README (portable across local + Vercel). */
export function readAuditPackHash(packId: string): Hex | null {
  const readmePath = auditPackReadmePath(packId)
  if (!existsSync(readmePath)) return null
  const match = readFileSync(readmePath, 'utf8').match(/packHash \(keccak256 of JSON\): (0x[a-fA-F0-9]{64})/)
  return match ? (match[1] as Hex) : null
}

/** On-chain invoiceId (bytes32) values that have a real audit pack on disk. */
export function listAuditPackInvoiceIds(): string[] {
  const packIds = new Set(listAuditPackIds())
  const manifest = loadManifest()
  return (manifest.invoices ?? [])
    .filter(
      (inv) =>
        packIds.has(inv.id.toUpperCase()) && typeof inv.invoiceId === 'string',
    )
    .map((inv) => inv.invoiceId.toLowerCase())
}

export function loadAuditPack(idOrHash: string): AuditPack | null {
  const packId = resolvePackId(idOrHash)
  if (!packId) return null

  const jsonPath = auditPackJsonPath(packId)
  if (!existsSync(jsonPath)) {
    return null
  }

  return JSON.parse(readFileSync(jsonPath, 'utf8')) as AuditPack
}

export function readAuditPackZip(packId: string): Buffer | null {
  const resolved = resolvePackId(packId)
  if (!resolved) return null
  const zipPath = auditPackZipPath(resolved)
  if (!existsSync(zipPath)) return null
  return readFileSync(zipPath)
}

/** Denial rows archived inside on-disk audit packs (off-chain inspect snapshots). */
export function aggregatePackDenialLogs(): Array<{ packId: string; entry: DenialLogEntry }> {
  const out: Array<{ packId: string; entry: DenialLogEntry }> = []
  for (const packId of listAuditPackIds()) {
    const pack = loadAuditPack(packId)
    if (!pack?.denialLog?.length) continue
    for (const raw of pack.denialLog) {
      const entry = raw as DenialLogEntry
      if (entry.ok === true) continue
      out.push({ packId, entry })
    }
  }
  return out
}
