'use client'

import { useCallback, useEffect, useState } from 'react'
import { DuplicateAttemptsPanel } from '@/components/DuplicateAttemptsPanel'
import type { IndexerDuplicate } from '@/lib/indexer'
import { useErrorToast } from '@/hooks/useErrorToast'

type Props = {
  address: string
}

export function OriginatorDuplicates({ address }: Props) {
  const [duplicates, setDuplicates] = useState<IndexerDuplicate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error ? `Indexer: ${error}` : null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/indexer?op=invoices&originator=${encodeURIComponent(address)}&limit=50`,
      )
      const json = (await res.json()) as { duplicates?: IndexerDuplicate[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setDuplicates(json.duplicates ?? [])
    } catch (e) {
      setDuplicates([])
      setError(e instanceof Error ? e.message : 'Failed to load duplicates')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <p className="neo-muted">Loading duplicate attempts from indexer…</p>
  }

  if (error) {
    return (
      <p className="neo-muted neo-text-md">
        Could not load duplicate attempts from indexer.
      </p>
    )
  }

  if (duplicates.length === 0) {
    return (
      <p className="neo-muted neo-text-md">
        No duplicate registration attempts indexed for your wallet.
      </p>
    )
  }

  return (
    <DuplicateAttemptsPanel
      duplicates={duplicates}
      title="Your duplicate registration attempts"
    />
  )
}
