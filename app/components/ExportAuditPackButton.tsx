'use client'

import { useState } from 'react'
import { NeoButton } from '@/components/neo/NeoButton'
import { useToast } from '@/context/ToastContext'

type Props = {
  invoiceId: string
  label?: string
  format?: 'json' | 'zip'
}

export function ExportAuditPackButton({
  invoiceId,
  label,
  format = 'json',
}: Props) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)

  const defaultLabel = format === 'zip' ? `Download ${invoiceId} ZIP` : `Export ${invoiceId} JSON`

  async function download() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ id: invoiceId })
      if (format === 'zip') params.set('format', 'zip')
      const res = await fetch(`/api/audit/pack?${params}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download =
        format === 'zip'
          ? `clearnote-audit-${invoiceId}.zip`
          : `clearnote-audit-${invoiceId}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <span className="export-audit-pack">
      <NeoButton variant="ghost" disabled={loading} onClick={download}>
        {loading ? 'Preparing…' : (label ?? defaultLabel)}
      </NeoButton>
    </span>
  )
}
