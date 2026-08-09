'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { NeoLoadingSkeleton } from '@/components/neo/NeoLoadingSkeleton'
import { formatCurrencyMajor, formatTokenAmount } from '@/lib/format'
import { useErrorToast } from '@/hooks/useErrorToast'

type Position = {
  invoiceId: string
  units: string
  status: number
  statusLabel: string
  faceValue: string
  currency: string
  source: 'issued' | 'dvp'
}

type Props = {
  holder: `0x${string}`
}

export function DashboardInvestorSummary({ holder }: Props) {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/investor/positions?holder=${encodeURIComponent(holder)}`)
      const json = (await res.json()) as { positions?: Position[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setError(null)
      setPositions(json.positions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load positions')
    } finally {
      setLoading(false)
    }
  }, [holder])

  useEffect(() => {
    load()
  }, [load])

  const financed = positions.filter((p) => p.status >= 3)
  const totalUnits = positions.reduce((sum, p) => sum + BigInt(p.units), BigInt(0))
  const parByCurrency = financed.reduce<Record<string, bigint>>((acc, p) => {
    const cur = p.currency || '—'
    acc[cur] = (acc[cur] ?? BigInt(0)) + BigInt(p.faceValue)
    return acc
  }, {})

  if (!loading && positions.length === 0) {
    return null
  }

  return (
    <NeoCard className="dashboard-investor">
      <div className="dashboard-pending__head">
        <h3>Investor positions</h3>
        <NeoButton variant="ghost" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </NeoButton>
      </div>
      <p className="neo-muted dashboard-activity__sub">
        CLINV01 lots from indexer + on-chain registry — same data as investor desk.
      </p>
      {loading && positions.length === 0 && <NeoLoadingSkeleton rows={2} />}
      {positions.length > 0 && (
        <dl className="investor-desk__balances">
          <div>
            <dt>Lots</dt>
            <dd>{positions.length}</dd>
          </div>
          <div>
            <dt>Units</dt>
            <dd>{formatTokenAmount(totalUnits, 18)}</dd>
          </div>
          {financed.length > 0 && (
            <div>
              <dt>Par (financed)</dt>
              <dd>
                {Object.entries(parByCurrency).map(([cur, val], i, arr) => (
                  <span key={cur}>
                    {formatCurrencyMajor(val, cur)}
                    {i < arr.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      )}
      <p className="dashboard-activity__footer">
        <Link href="/investor">Open investor desk →</Link>
      </p>
    </NeoCard>
  )
}
