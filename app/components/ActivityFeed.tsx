'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { NeoLoadingSkeleton } from '@/components/neo/NeoLoadingSkeleton'
import { addresses, explorerUrl } from '@/lib/config'
import { formatTokenAmount, formatUnixDateTime } from '@/lib/format'
import type { IndexerMetadata, IndexerTransfer } from '@/lib/indexer'
import { parseBlockFromTransferId } from '@/lib/indexer'
import { useErrorToast } from '@/hooks/useErrorToast'

const DEFAULT_TOKEN_FILTER = 'CLINV01'

const TOKEN_OPTIONS = [
  { value: '', label: 'All tokens' },
  { value: 'CLINV01', label: 'CLINV01 (product)' },
  { value: 'CLNOTE02', label: 'CLNOTE02 (history)' },
  { value: 'CLLAT01', label: 'CLLAT01 (reason codes)' },
] as const

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function formatTransferValue(value: string): string {
  try {
    return formatTokenAmount(BigInt(value), 18)
  } catch {
    return value
  }
}

export function ActivityFeed({
  initialWallet,
  initialOnlyMine = false,
  initialToken = DEFAULT_TOKEN_FILTER,
}: {
  initialWallet?: string
  initialOnlyMine?: boolean
  initialToken?: string
} = {}) {
  const { address } = useAccount()
  const [transfers, setTransfers] = useState<IndexerTransfer[]>([])
  const [total, setTotal] = useState(0)
  const [metadata, setMetadata] = useState<IndexerMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [walletFilter, setWalletFilter] = useState(initialWallet ?? '')
  const [tokenFilter, setTokenFilter] = useState(initialToken)
  const [onlyMine, setOnlyMine] = useState(initialOnlyMine)

  useErrorToast(error)

  const activeWallet = onlyMine && address ? address : walletFilter.trim()

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ op: 'transfers', limit: '25' })
    if (activeWallet && isAddress(activeWallet)) {
      params.set('wallet', activeWallet)
    }
    if (tokenFilter) params.set('token', tokenFilter)
    return params.toString()
  }, [activeWallet, tokenFilter])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/indexer?${queryString}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
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
  }, [queryString])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

  const showTable = transfers.length > 0 || !loading

  return (
    <div className="activity-feed">
      <NeoCard className="activity-feed__filters">
        <div className="activity-feed__filter-row">
          <label>
            Token
            <select
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              className="neo-input"
            >
              {TOKEN_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Wallet filter
            <input
              type="text"
              className="neo-input"
              placeholder="0x… (from or to)"
              value={onlyMine ? '' : walletFilter}
              disabled={onlyMine}
              onChange={(e) => setWalletFilter(e.target.value)}
            />
          </label>
          <label className="activity-feed__checkbox">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              disabled={!address}
            />
            Only my wallet
          </label>
          <NeoButton variant="ghost" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </NeoButton>
        </div>
        {!address && (
          <p className="neo-muted activity-feed__hint">
            Connect a wallet to filter transfers involving your address.
          </p>
        )}
      </NeoCard>

      {metadata && (
        <p className="muted activity-feed__meta">
          Chain {metadata.chain_id} · block {metadata.latest_processed_block} ·{' '}
          {metadata.num_events_processed} events indexed · {total} transfers
          {activeWallet && isAddress(activeWallet) ? ' matching filter' : ' total'}
        </p>
      )}

      {loading && transfers.length === 0 && <NeoLoadingSkeleton rows={5} />}

      {showTable && (
        <table className="neo-table activity-feed__table">
          <thead>
            <tr>
              <th>Token</th>
              <th>From</th>
              <th>To</th>
              <th>Amount</th>
              <th>Time (SGT)</th>
              <th>Block</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => {
              const block = t.blockNumber ?? parseBlockFromTransferId(t.id)
              const mine =
                address &&
                (t.from.toLowerCase() === address.toLowerCase() ||
                  t.to.toLowerCase() === address.toLowerCase())
              return (
                <tr key={t.id} className={mine ? 'activity-feed__row--mine' : undefined}>
                  <td>
                    <span className={`activity-feed__token activity-feed__token--${t.token?.toLowerCase()}`}>
                      {t.token ?? '—'}
                    </span>
                  </td>
                  <td>
                    <code title={t.from}>{shortAddr(t.from)}</code>
                  </td>
                  <td>
                    <code title={t.to}>{shortAddr(t.to)}</code>
                  </td>
                  <td>{formatTransferValue(t.value)}</td>
                  <td className="neo-muted activity-feed__time">
                    {t.blockTimestamp != null ? (
                      block != null ? (
                        <a
                          href={`${explorerUrl}/block/${block}`}
                          target="_blank"
                          rel="noreferrer"
                          title={`On-chain block time · ${new Date(t.blockTimestamp * 1000).toISOString()} (UTC)`}
                        >
                          <time dateTime={new Date(t.blockTimestamp * 1000).toISOString()}>
                            {formatUnixDateTime(t.blockTimestamp)}
                          </time>
                        </a>
                      ) : (
                        <time
                          dateTime={new Date(t.blockTimestamp * 1000).toISOString()}
                          title={`On-chain block time · ${new Date(t.blockTimestamp * 1000).toISOString()} (UTC)`}
                        >
                          {formatUnixDateTime(t.blockTimestamp)}
                        </time>
                      )
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="neo-muted">
                    {block != null ? (
                      <a
                        href={`${explorerUrl}/block/${block}`}
                        target="_blank"
                        rel="noreferrer"
                        title={t.id}
                      >
                        {block}
                      </a>
                    ) : (
                      t.id
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {!loading && transfers.length === 0 && (
        <p className="muted">No transfers match this filter yet.</p>
      )}

      <p className="neo-muted activity-feed__foot">
        Product token: <code>{addresses.clinv01}</code> · History token:{' '}
        <code>{addresses.clnote02}</code>
      </p>
    </div>
  )
}
