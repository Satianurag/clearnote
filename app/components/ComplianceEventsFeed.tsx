'use client'

import { useCallback, useEffect, useState } from 'react'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { NeoLoadingSkeleton } from '@/components/neo/NeoLoadingSkeleton'
import { explorerUrl } from '@/lib/config'
import { formatUnixDateTime } from '@/lib/format'
import type { IndexerComplianceEvent } from '@/lib/indexer'
import { useErrorToast } from '@/hooks/useErrorToast'

function shortHash(h: string) {
  return h.length > 18 ? `${h.slice(0, 10)}…${h.slice(-6)}` : h
}

function parseBlockFromEventId(id: string): number | null {
  const parts = id.split('_')
  if (parts.length < 2) return null
  const block = Number(parts[1])
  return Number.isFinite(block) ? block : null
}

export function ComplianceEventsFeed() {
  const [events, setEvents] = useState<IndexerComplianceEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/indexer?op=compliance&limit=30')
      const json = (await res.json()) as { events?: IndexerComplianceEvent[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setError(null)
      setEvents(json.events ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load compliance events')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <NeoCard className="compliance-events">
      <div className="compliance-events__head">
        <h3 className="compliance-events__title">On-chain compliance history</h3>
        <NeoButton variant="ghost" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </NeoButton>
      </div>
      <p className="neo-muted neo-text-sm">
        Indexed <code>RootCommitted</code>, <code>SanctionedAdded</code>, and{' '}
        <code>Anchored</code> events from Envio — not mocked.
      </p>
      {loading && events.length === 0 && <NeoLoadingSkeleton rows={4} />}
      {!loading && events.length === 0 && (
        <p className="neo-muted">No compliance events indexed yet.</p>
      )}
      {events.length > 0 && (
        <ul className="compliance-events__list">
          {events.map((ev) => {
            const block = parseBlockFromEventId(ev.id)
            const blockLink =
              block != null ? (
                <a href={`${explorerUrl}/block/${block}`} target="_blank" rel="noreferrer">
                  block {block}
                </a>
              ) : null

            if (ev.kind === 'root') {
              return (
                <li key={ev.id}>
                  <strong>OFAC root committed</strong> ·{' '}
                  <code title={ev.root}>{shortHash(ev.root)}</code>
                  {ev.sourceUri && (
                    <span className="neo-muted"> · {ev.sourceUri}</span>
                  )}
                  <span className="neo-muted"> · {formatUnixDateTime(Number(ev.publishedAt))}</span>
                  {blockLink && <> · {blockLink}</>}
                </li>
              )
            }
            if (ev.kind === 'sanctioned') {
              return (
                <li key={ev.id}>
                  <strong>SanctionedAdded</strong> · <code>{ev.who}</code>
                  {blockLink && <> · {blockLink}</>}
                </li>
              )
            }
            return (
              <li key={ev.id}>
                <strong>Audit pack anchored</strong> · anchor #{ev.anchorId} ·{' '}
                <code title={ev.packHash}>{shortHash(ev.packHash)}</code>
                {ev.uri && <span className="neo-muted"> · {ev.uri}</span>}
                {blockLink && <> · {blockLink}</>}
              </li>
            )
          })}
        </ul>
      )}
    </NeoCard>
  )
}
