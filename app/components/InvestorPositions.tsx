'use client'

import { useCallback, useEffect, useState } from 'react'
import { type Hex } from 'viem'
import { NeoCard } from '@/components/neo/NeoCard'
import { NeoLoadingSkeleton } from '@/components/neo/NeoLoadingSkeleton'
import { InvoiceStatusTimeline } from '@/components/InvoiceStatusTimeline'
import { SettlementPanel } from '@/components/SettlementPanel'
import { addresses, explorerUrl } from '@/lib/config'
import { formatCurrencyMajor, formatTokenAmount, formatUnixDate } from '@/lib/format'
import { shortHash } from '@/lib/invoice-acceptance'
import { useErrorToast } from '@/hooks/useErrorToast'

type Position = {
  invoiceId: string
  units: string
  source: 'issued' | 'dvp'
  cashPaid?: string
  offerId?: string
  status: number
  statusLabel: string
  faceValue: string
  dueDate: string
  currency: string
  obligor: string
}

type Props = {
  holder: `0x${string}`
  noteBalance?: bigint
}

export function InvestorPositions({ holder, noteBalance }: Props) {
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Position | null>(null)

  useErrorToast(error)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/investor/positions?holder=${encodeURIComponent(holder)}`)
      const json = (await res.json()) as { positions?: Position[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setPositions(json.positions ?? [])
      setSelected((prev) => {
        if (!prev) return json.positions?.[0] ?? null
        return json.positions?.find((p) => p.invoiceId === prev.invoiceId) ?? json.positions?.[0] ?? null
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load positions')
    } finally {
      setLoading(false)
    }
  }, [holder])

  useEffect(() => {
    load()
  }, [load])

  const totalUnits = positions.reduce((sum, p) => sum + BigInt(p.units), BigInt(0))

  const financed = positions.filter((p) => p.status >= 3)
  const faceByCurrency = financed.reduce<Record<string, bigint>>((acc, p) => {
    const cur = p.currency || '—'
    acc[cur] = (acc[cur] ?? BigInt(0)) + BigInt(p.faceValue)
    return acc
  }, {})
  const cashDeployed = positions.reduce((sum, p) => {
    if (!p.cashPaid) return sum
    return sum + BigInt(p.cashPaid)
  }, BigInt(0))

  return (
    <div className="investor-positions">
      <NeoCard>
        <h3 className="dvp-section__title">Your positions</h3>
        <p className="neo-muted">
          CLINV01 holdings from primary issuance and DvP fills — enriched with on-chain registry
          status.
        </p>
        <dl className="investor-desk__balances">
          <div>
            <dt>Wallet CLINV01</dt>
            <dd>{noteBalance != null ? formatTokenAmount(noteBalance, 18) : '…'}</dd>
          </div>
          <div>
            <dt>Indexed lots</dt>
            <dd>{positions.length}</dd>
          </div>
          <div>
            <dt>Indexed units</dt>
            <dd>{positions.length > 0 ? formatTokenAmount(totalUnits, 18) : '0'}</dd>
          </div>
          {financed.length > 0 && (
            <div>
              <dt>Par value (financed)</dt>
              <dd>
                {Object.entries(faceByCurrency).map(([cur, val], i, arr) => (
                  <span key={cur}>
                    {formatCurrencyMajor(val, cur)}
                    {i < arr.length - 1 ? ' · ' : ''}
                  </span>
                ))}
              </dd>
            </div>
          )}
          {cashDeployed > BigInt(0) && (
            <div>
              <dt>Cash deployed (DvP)</dt>
              <dd>{formatTokenAmount(cashDeployed, 6)} aUSDC</dd>
            </div>
          )}
        </dl>
      </NeoCard>

      {loading && positions.length === 0 && <NeoLoadingSkeleton rows={3} />}

      {!loading && positions.length === 0 && (
        <NeoCard>
          <p className="neo-muted">No indexed CLINV01 positions for this wallet yet.</p>
          <p className="neo-muted neo-text-sm">
            Fill a DvP offer below or receive a primary issuance after finance.
          </p>
        </NeoCard>
      )}

      {positions.length > 0 && (
        <table className="neo-table investor-positions__table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Units</th>
              <th>Face value</th>
              <th>Due</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr
                key={p.invoiceId}
                className={selected?.invoiceId === p.invoiceId ? 'investor-positions__row--active' : ''}
                onClick={() => setSelected(p)}
              >
                <td>
                  <code title={p.invoiceId}>{shortHash(p.invoiceId as Hex)}</code>
                </td>
                <td>{formatTokenAmount(BigInt(p.units), 18)}</td>
                <td>{formatCurrencyMajor(BigInt(p.faceValue), p.currency)}</td>
                <td>{formatUnixDate(BigInt(p.dueDate))}</td>
                <td>{p.statusLabel}</td>
                <td className="neo-muted">{p.source === 'dvp' ? 'DvP fill' : 'Issued'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && selected.status >= 3 && (
        <NeoCard className="investor-positions__settlement">
          <SettlementPanel
            invoiceId={selected.invoiceId as Hex}
            status={selected.status}
            faceValue={BigInt(selected.faceValue)}
            dueDate={BigInt(selected.dueDate)}
            currency={selected.currency}
            obligor={selected.obligor as `0x${string}`}
          />
          <p className="neo-muted neo-text-sm investor-positions__explorer">
            <a href={`${explorerUrl}/address/${addresses.registry}`} target="_blank" rel="noreferrer">
              InvoiceRegistry on Monadscan →
            </a>
          </p>
        </NeoCard>
      )}

      {selected && selected.status < 3 && (
        <NeoCard>
          <InvoiceStatusTimeline status={selected.status} />
          <p className="neo-muted">Pre-finance — no settlement view until status is Financed.</p>
        </NeoCard>
      )}
    </div>
  )
}
