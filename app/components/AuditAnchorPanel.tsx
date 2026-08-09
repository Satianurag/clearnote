'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { NeoCard } from '@/components/neo/NeoCard'
import { useErrorToast } from '@/hooks/useErrorToast'
import { addresses } from '@/lib/config'
import { explorerUrl } from '@/lib/config'

type AnchorRow = {
  anchorId: string
  packHash: string
  uri: string
  periodStart: number
  periodEnd: number
  anchoredAt: number
}

type PackStatus = {
  packId: string
  packHash: string | null
  anchored: boolean
  matchingAnchorId: string | null
  anchorTx: string | null
  onChainUri: string | null
}

export function AuditAnchorPanel() {
  const [anchors, setAnchors] = useState<AnchorRow[]>([])
  const [packs, setPacks] = useState<PackStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  useEffect(() => {
    fetch('/api/audit/anchor')
      .then((r) => r.json())
      .then((json: { anchors?: AnchorRow[]; packs?: PackStatus[]; error?: string }) => {
        if (json.error) throw new Error(json.error)
        setAnchors(json.anchors ?? [])
        setPacks(json.packs ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load anchors'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <NeoCard className="audit-anchor-panel">
      <h3 className="dvp-section__title">AuditAnchor (on-chain hashes)</h3>
      <p className="neo-muted neo-text-sm">
        <code>{addresses.auditAnchor}</code> stores <strong>packHash</strong> only — no PII on-chain.
        Anchor via <code>pnpm audit:anchor INV-001</code> (Safe 2-of-3).
      </p>

      {loading && <p className="neo-muted">Reading AuditAnchor on Monad testnet…</p>}

      {!loading && packs.length > 0 && (
        <table className="neo-table audit-anchor-panel__table">
          <thead>
            <tr>
              <th>Pack</th>
              <th>On-chain</th>
              <th>packHash (local)</th>
              <th>Tx</th>
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.packId}>
                <td>{p.packId}</td>
                <td className={p.anchored ? 'ok' : 'warn'}>
                  {p.anchored ? `anchored #${p.matchingAnchorId}` : 'not anchored'}
                </td>
                <td>
                  <code className="audit-anchor-panel__hash" title={p.packHash ?? undefined}>
                    {p.packHash ? `${p.packHash.slice(0, 10)}…` : '—'}
                  </code>
                </td>
                <td>
                  {p.anchorTx ? (
                    <a href={`${explorerUrl}/tx/${p.anchorTx}`} target="_blank" rel="noreferrer">
                      {p.anchorTx.slice(0, 10)}…
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && anchors.length > 0 && (
        <details className="audit-anchor-panel__details">
          <summary>All on-chain anchor records ({anchors.length})</summary>
          <ul className="neo-list-disc neo-text-sm">
            {anchors.map((a) => (
              <li key={a.anchorId}>
                #{a.anchorId} · <code>{a.packHash.slice(0, 14)}…</code> · {a.uri}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="neo-muted neo-text-sm neo-mt-md">
        <Link href="/api/audit/anchor">/api/audit/anchor</Link> · IVMS101 off-chain via{' '}
        <Link href="/api/ivms/generate">POST /api/ivms/generate</Link>
      </p>
    </NeoCard>
  )
}
