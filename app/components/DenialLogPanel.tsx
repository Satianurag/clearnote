'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatIsoTimestamp } from '@/lib/format'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import type { DenialLogEntry } from '@/lib/audit-pack'
import { useErrorToast } from '@/hooks/useErrorToast'

type LiveDenial = DenialLogEntry & {
  scenario: string
  enforcedBy?: string
  layer?: string
}

type PackRow = { packId: string; entry: DenialLogEntry }

export function DenialLogPanel() {
  const [live, setLive] = useState<LiveDenial[]>([])
  const [archived, setArchived] = useState<PackRow[]>([])
  const [capturedAt, setCapturedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [archiveNote, setArchiveNote] = useState<string | null>(null)

  useErrorToast(error)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [liveRes, archRes] = await Promise.all([
        fetch('/api/compliance/denials'),
        fetch('/api/audit/denial-log'),
      ])
      const liveJson = (await liveRes.json()) as {
        denials?: LiveDenial[]
        capturedAt?: string
        errors?: Array<{ scenario: string; reason: string }>
        error?: string
      }
      const archJson = (await archRes.json()) as {
        entries?: PackRow[]
        note?: string
        error?: string
      }

      if (!liveRes.ok) throw new Error(liveJson.error ?? `live HTTP ${liveRes.status}`)
      setLive(liveJson.denials ?? [])
      setCapturedAt(liveJson.capturedAt ?? null)
      if (liveJson.errors?.length) {
        setError(`${liveJson.errors.length} inspect scenario(s) errored — partial results shown`)
      }

      if (archRes.ok) {
        setArchived(archJson.entries ?? [])
        setArchiveNote(archJson.note ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load denial log')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <NeoCard className="denial-log-panel">
      <div className="denial-log-panel__toolbar">
        <h3 className="denial-log-panel__title">Policy denial log</h3>
        <NeoButton variant="ghost" type="button" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh live'}
        </NeoButton>
      </div>
      <p className="neo-muted neo-text-sm">
        Policy hook is <code>STATICCALL</code> — denials are not on-chain events. Live rows come from{' '}
        <code>ClearNotePolicy.inspect()</code> reference scenarios (same as the compliance matrix).
        Archived rows come only from real <code>seed/audit-packs/*.json</code> files.
      </p>

      {capturedAt && (
        <p className="neo-muted denial-log-panel__meta">
          Live snapshot: {formatIsoTimestamp(capturedAt)}
        </p>
      )}

      {loading && live.length === 0 ? (
        <p className="neo-muted">Running live inspect() scenarios…</p>
      ) : (
        <table className="neo-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Scenario</th>
              <th>Selector</th>
              <th>Enforced by</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {live.map((row) => (
              <tr key={`live-${row.scenario}`}>
                <td>Live matrix</td>
                <td>{row.scenario}</td>
                <td>
                  <code>{row.selector}</code>
                </td>
                <td>{row.enforcedBy ?? '—'}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
            {archived.map(({ packId, entry }, i) => (
              <tr key={`arch-${packId}-${i}`}>
                <td>Pack {packId}</td>
                <td>{entry.scenario ?? '—'}</td>
                <td>
                  <code>{entry.selector ?? '—'}</code>
                </td>
                <td>—</td>
                <td>{entry.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!loading && live.length === 0 && archived.length === 0 && (
        <p className="neo-muted">No denials returned — all reference inspect scenarios passed.</p>
      )}

      {archiveNote && (
        <p className="neo-muted neo-text-sm">
          {archiveNote}
        </p>
      )}

      <p className="neo-muted neo-text-sm denial-log-panel__footer">
        <Link href="/compliance/matrix">Open full compliance matrix</Link> · export archived denials via{' '}
        <code>pnpm audit:pack</code>
      </p>
    </NeoCard>
  )
}
