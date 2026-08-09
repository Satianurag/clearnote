import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPublicClient, http, type Hex } from 'viem'
import { auditPackJsonPath, listAuditPackIds, loadAuditPack } from '@/lib/audit-pack'
import { addresses, rpcUrl } from '@/lib/config'
import { repoRoot } from '@/lib/repo-root'
import { auditAnchorAbi } from '@/lib/contracts'
import { execFileSync } from 'node:child_process'

export type OnChainAnchor = {
  anchorId: string
  packHash: Hex
  uri: string
  periodStart: number
  periodEnd: number
  anchoredAt: number
}

function loadDeploymentE2e(): Record<string, string> {
  const path = resolve(repoRoot(), 'deployments/monad-10143.json')
  if (!existsSync(path)) return {}
  const deploy = JSON.parse(readFileSync(path, 'utf8')) as { e2e?: Record<string, string> }
  return deploy.e2e ?? {}
}

function packHashOnDisk(packId: string): Hex | null {
  const path = auditPackJsonPath(packId)
  if (!existsSync(path) || !loadAuditPack(packId)) return null
  // Match cast keccak (audit-pack.mjs source of truth for anchoring)
  const hash = execFileSync('cast', ['keccak', path], { encoding: 'utf8' }).trim()
  return hash as Hex
}

export async function readOnChainAnchors(): Promise<OnChainAnchor[]> {
  const client = createPublicClient({ transport: http(rpcUrl) })
  const count = await client.readContract({
    address: addresses.auditAnchor,
    abi: auditAnchorAbi,
    functionName: 'anchorCount',
  })

  const out: OnChainAnchor[] = []
  const total = Number(count)
  for (let i = 0; i < total; i++) {
    const [packHash, uri, periodStart, periodEnd, anchoredAt] = await client.readContract({
      address: addresses.auditAnchor,
      abi: auditAnchorAbi,
      functionName: 'anchors',
      args: [BigInt(i)],
    })
    out.push({
      anchorId: String(i),
      packHash,
      uri,
      periodStart: Number(periodStart),
      periodEnd: Number(periodEnd),
      anchoredAt: Number(anchoredAt),
    })
  }
  return out
}

export type PackAnchorStatus = {
  packId: string
  packHash: Hex | null
  anchored: boolean
  matchingAnchorId: string | null
  anchorTx: string | null
  onChainUri: string | null
}

export async function packAnchorStatuses(): Promise<PackAnchorStatus[]> {
  const anchors = await readOnChainAnchors()
  const e2e = loadDeploymentE2e()

  return listAuditPackIds().map((packId) => {
    const packHash = packHashOnDisk(packId)
    const match = packHash
      ? anchors.find((a) => a.packHash.toLowerCase() === packHash.toLowerCase())
      : undefined
    return {
      packId,
      packHash,
      anchored: Boolean(match),
      matchingAnchorId: match?.anchorId ?? null,
      anchorTx: e2e[`auditAnchor_${packId}`] ?? null,
      onChainUri: match?.uri ?? null,
    }
  })
}
