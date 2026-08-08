'use client'

import { useCallback, useEffect, useState } from 'react'
import type { IndexerMetadata, IndexerTransfer } from '@/lib/indexer'

export function ActivityFeed() {
  const [transfers, setTransfers] = useState<IndexerTransfer[]>([])
  const [total, setTotal] = useState(0)
  const [metadata, setMetadata] = useState<IndexerMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/indexer?limit=25')
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        setTransfers([])
        return
      }
      setError(null)
      setTransfers(json.transfers ?? [])
      setTotal(json.total ?? 0)
      setMetadata(json.metadata ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  if (loading && transfers.length === 0) return <p>Loading indexed transfers…</p>
  if (error) return <p className="error">Indexer: {error}</p>

  return (
    <div>
      {metadata && (
        <p className="muted">
          Chain {metadata.chain_id} · block {metadata.latest_processed_block} ·{' '}
          {metadata.num_events_processed} events indexed · {total} transfers total
        </p>
      )}
      <button type="button" onClick={load} disabled={loading} style={{ marginBottom: 12 }}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
      <table className="table">
        <thead>
          <tr>
            <th>Token</th>
            <th>From</th>
            <th>To</th>
            <th>Value</th>
            <th>ID</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <tr key={t.id}>
              <td>{t.token ?? '—'}</td>
              <td><code>{shortAddr(t.from)}</code></td>
              <td><code>{shortAddr(t.to)}</code></td>
              <td>{t.value}</td>
              <td className="muted">{t.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {transfers.length === 0 && <p className="muted">No transfers indexed yet.</p>}
    </div>
  )
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}
