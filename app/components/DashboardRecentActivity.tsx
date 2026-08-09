'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { NeoLoadingSkeleton } from '@/components/neo/NeoLoadingSkeleton'
import { formatCurrencyMajor, formatTokenAmount } from '@/lib/format'
import { explorerUrl } from '@/lib/config'
import type { IndexerTransfer } from '@/lib/indexer'
import { useErrorToast } from '@/hooks/useErrorToast'

type Props = {
  address: `0x${string}`
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function parseBlockFromEventId(id: string): number | null {
  const parts = id.split('_')
  if (parts.length < 2) return null
  const block = Number(parts[1])
  return Number.isFinite(block) ? block : null
}

export function DashboardRecentActivity({ address }: Props) {
  const [transfers, setTransfers] = useState<IndexerTransfer[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        op: 'transfers',
        wallet: address,
        limit: '8',
        token: 'CLINV01',
      })
      const res = await fetch(`/api/indexer?${params}`)
      const json = (await res.json()) as {
        transfers?: IndexerTransfer[]
        total?: number
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setError(null)
      setTransfers(json.transfers ?? [])
      setTotal(json.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    load()
  }, [load])

  return (
    <NeoCard className="dashboard-activity">
      <div className="dashboard-pending__head">
        <h3>Recent CLINV01 transfers</h3>
        <NeoButton variant="ghost" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </NeoButton>
      </div>
      <p className="neo-muted dashboard-activity__sub">
        Envio-indexed product token transfers involving your wallet.
      </p>
      {loading && transfers.length === 0 && <NeoLoadingSkeleton rows={4} />}
      {transfers.length === 0 && !loading && (
        <p className="neo-muted">No indexed CLINV01 transfers for this wallet yet.</p>
      )}
      {transfers.length > 0 && (
        <table className="neo-table dashboard-activity__table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Dir</th>
              <th>Counterparty</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => {
              const sent = t.from.toLowerCase() === address.toLowerCase()
              const counterparty = sent ? t.to : t.from
              const block = parseBlockFromEventId(t.id)
              return (
                <tr key={t.id}>
                  <td>{t.token ?? '—'}</td>
                  <td className={sent ? 'dashboard-activity__out' : 'dashboard-activity__in'}>
                    {sent ? 'out' : 'in'}
                  </td>
                  <td>
                    <code title={counterparty}>{shortAddr(counterparty)}</code>
                  </td>
                  <td>
                    {formatTokenAmount(BigInt(t.value), 18)}
                    {block != null && (
                      <a
                        className="dashboard-activity__block"
                        href={`${explorerUrl}/block/${block}`}
                        target="_blank"
                        rel="noreferrer"
                        title={t.id}
                      >
                        ↗
                      </a>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="dashboard-activity__footer">
        <Link href={`/activity?wallet=${encodeURIComponent(address)}`}>
          View all {total > transfers.length ? `${total} ` : ''}transfers →
        </Link>
      </p>
    </NeoCard>
  )
}
