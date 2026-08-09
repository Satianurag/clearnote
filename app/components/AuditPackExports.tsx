'use client'

import { useEffect, useState } from 'react'
import { ExportAuditPackButton } from '@/components/ExportAuditPackButton'
import { useAuditPackIds } from '@/hooks/useAuditPackIds'
import { useErrorToast } from '@/hooks/useErrorToast'

type PackMeta = { id: string; hasZip: boolean }

export function AuditPackExports() {
  const { packs, loading } = useAuditPackIds()
  const [meta, setMeta] = useState<PackMeta[]>([])
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  useEffect(() => {
    if (loading) return
    fetch('/api/audit/pack/list')
      .then((r) => r.json())
      .then((json: { meta?: PackMeta[]; packs?: string[]; error?: string }) => {
        setMeta(json.meta ?? json.packs?.map((id) => ({ id, hasZip: false })) ?? [])
        if (!json.packs?.length) {
          setError('No audit packs on disk — run pnpm audit:pack INV-001 from repo root.')
        } else {
          setError(null)
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to list packs'))
  }, [loading, packs.length])

  if (loading) {
    return <p className="muted">Loading available audit packs…</p>
  }

  if (error || meta.length === 0) {
    return <p className="neo-muted">No audit packs available.</p>
  }

  return (
    <div className="audit-pack-exports">
      {meta.map(({ id, hasZip }) => (
        <div key={id} className="audit-pack-exports__row">
          <ExportAuditPackButton invoiceId={id} format="json" label={`${id} JSON`} />
          {hasZip ? (
            <ExportAuditPackButton invoiceId={id} format="zip" label={`${id} ZIP`} />
          ) : (
            <span className="neo-muted neo-text-sm">ZIP — run pnpm audit:pack {id}</span>
          )}
        </div>
      ))}
    </div>
  )
}
