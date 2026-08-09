'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { getAddress, type Hex } from 'viem'
import { useReadContract } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { useWalletSession } from '@/hooks/useWalletSession'
import { addresses, explorerUrl } from '@/lib/config'
import { invoiceRegistryAbi } from '@/lib/contracts'
import {
  INVOICE_STATUS,
  isBytes32,
  shortHash,
  type InvoiceStatusCode,
} from '@/lib/invoice-acceptance'
import {
  isSameAddress,
  loadPinnedInvoices,
  savePinnedInvoice,
} from '@/lib/registry'

type PortfolioInvoice = {
  invoiceId: string
  originator: string
  obligor: string
  source: 'indexer' | 'pinned' | 'manual'
}

type IndexerPayload = {
  invoices: Array<{ invoiceId: string; originator: string; obligor: string }>
  duplicates: Array<{ invoiceId: string }>
  error?: string
}

type OnChainRow = {
  invoiceId: string
  status: number
  statusLabel: string
  obligor: string
}

type FinanceState = {
  invoiceId: string
  phase: 'idle' | 'submitting' | 'success' | 'error'
  txHash?: string
  error?: string
}

function InvoiceStatusBadge({ status }: { status: number }) {
  const label = INVOICE_STATUS[status as InvoiceStatusCode] ?? `Unknown (${status})`
  const cls =
    status === 3 ? 'portfolio-badge portfolio-badge--financed' :
    status === 2 ? 'portfolio-badge portfolio-badge--accepted' :
    status === 1 ? 'portfolio-badge portfolio-badge--registered' :
    'portfolio-badge'
  return <span className={cls}>{label}</span>
}

function useOnChainInvoice(invoiceId: Hex | null) {
  const { data, isLoading, refetch } = useReadContract({
    address: addresses.registry,
    abi: invoiceRegistryAbi,
    functionName: 'get',
    args: invoiceId ? [invoiceId] : undefined,
    query: { enabled: Boolean(invoiceId) },
  })

  const inv = data as {
    originator?: `0x${string}`
    obligor?: `0x${string}`
    status?: number
  } | undefined

  return {
    isLoading,
    refetch,
    row: inv
      ? {
          originator: inv.originator ?? ('0x0' as `0x${string}`),
          obligor: inv.obligor ?? ('0x0' as `0x${string}`),
          status: Number(inv.status ?? 0),
        }
      : null,
  }
}

function PortfolioRow({
  invoice,
  originator,
  onFinance,
  finance,
}: {
  invoice: PortfolioInvoice
  originator: `0x${string}`
  onFinance: (id: string) => void
  finance: FinanceState | null
}) {
  const id = invoice.invoiceId as Hex
  const { row, isLoading, refetch } = useOnChainInvoice(id)

  if (isLoading && !row) {
    return (
      <tr>
        <td><code>{shortHash(id)}</code></td>
        <td colSpan={4} className="neo-muted">Loading on-chain…</td>
      </tr>
    )
  }

  if (!row || row.status === 0) {
    return (
      <tr>
        <td><code>{shortHash(id)}</code></td>
        <td colSpan={4} className="neo-muted">Not found on registry</td>
      </tr>
    )
  }

  if (!isSameAddress(row.originator, originator)) {
    return (
      <tr>
        <td><code>{shortHash(id)}</code></td>
        <td colSpan={4} className="error">
          Wrong originator — belongs to {row.originator.slice(0, 10)}…
        </td>
      </tr>
    )
  }

  const status = row.status
  const canFinance = status === 2
  const isFinanced = status >= 3
  const busy = finance?.invoiceId === invoice.invoiceId && finance.phase === 'submitting'

  return (
    <tr>
      <td>
        <code title={invoice.invoiceId}>{shortHash(id)}</code>
        {invoice.source !== 'indexer' && (
          <span className="portfolio-source" title={`Source: ${invoice.source}`}>★</span>
        )}
      </td>
      <td><code>{row.obligor.slice(0, 10)}…</code></td>
      <td><InvoiceStatusBadge status={status} /></td>
      <td className="neo-muted">{invoice.source}</td>
      <td>
        {canFinance && (
          <NeoButton variant="secondary" disabled={busy} onClick={() => onFinance(invoice.invoiceId)}>
            {busy ? 'Safe executing…' : 'Finance (issueNote)'}
          </NeoButton>
        )}
        {isFinanced && <Link href="/investor">Trade on DvP →</Link>}
        {status === 1 && (
          <Link href={`/obligor?invoice=${invoice.invoiceId}`}>Await obligor →</Link>
        )}
        <NeoButton variant="ghost" onClick={() => refetch()}>
          Refresh
        </NeoButton>
      </td>
    </tr>
  )
}

export function OriginatorPortfolio() {
  const params = useSearchParams()
  const { address, isReady } = useWalletSession()
  const [data, setData] = useState<IndexerPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [finance, setFinance] = useState<FinanceState | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [pinned, setPinned] = useState<Hex[]>([])
  const [manualError, setManualError] = useState<string | null>(null)

  const urlInvoice = params.get('invoice')?.trim() ?? ''

  useEffect(() => {
    if (address) setPinned(loadPinnedInvoices(address))
  }, [address])

  useEffect(() => {
    if (isBytes32(urlInvoice) && address) {
      savePinnedInvoice(address, urlInvoice as Hex)
      setPinned(loadPinnedInvoices(address))
    }
  }, [urlInvoice, address])

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/indexer?op=invoices&originator=${encodeURIComponent(address)}&limit=50`,
      )
      const json = (await res.json()) as IndexerPayload
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setData({
        invoices: [],
        duplicates: [],
        error: e instanceof Error ? e.message : 'Failed to load indexer',
      })
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (isReady && address) load()
  }, [isReady, address, load])

  const portfolio = useMemo(() => {
    const map = new Map<string, PortfolioInvoice>()
    for (const inv of data?.invoices ?? []) {
      map.set(inv.invoiceId.toLowerCase(), { ...inv, source: 'indexer' })
    }
    for (const id of pinned) {
      const key = id.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          invoiceId: id,
          originator: address ?? '',
          obligor: '—',
          source: 'pinned',
        })
      }
    }
    return [...map.values()]
  }, [data?.invoices, pinned, address])

  async function financeInvoice(invoiceId: string) {
    if (!address) return
    setFinance({ invoiceId, phase: 'submitting' })
    try {
      const res = await fetch('/api/safe/issue-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, recipient: getAddress(address) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setFinance({ invoiceId, phase: 'success', txHash: json.txHash })
      await load()
    } catch (e) {
      setFinance({
        invoiceId,
        phase: 'error',
        error: e instanceof Error ? e.message : 'Finance failed',
      })
    }
  }

  async function addManualInvoice() {
    const raw = manualInput.trim()
    if (!isBytes32(raw)) {
      setManualError('Enter a valid bytes32 invoice hash (0x + 64 hex chars)')
      return
    }
    if (!address) return
    setManualError(null)
    const res = await fetch(`/api/registry/invoice?invoiceId=${encodeURIComponent(raw)}`)
    const json = await res.json()
    if (!res.ok) {
      setManualError(json.error ?? 'Invoice not on registry')
      return
    }
    if (!isSameAddress(json.originator, address)) {
      setManualError('This invoice belongs to a different originator wallet')
      return
    }
    savePinnedInvoice(address, raw as Hex)
    setPinned(loadPinnedInvoices(address))
    setManualInput('')
  }

  if (!isReady || !address) {
    return <p className="neo-muted">Connect wallet to view your originator portfolio.</p>
  }

  return (
    <div className="originator-portfolio">
      <p className="neo-muted">
        Indexer discovery + on-chain registry status · finance via Safe 2-of-3 (
        <code>{addresses.safe}</code>).
      </p>

      <NeoCard className="originator-portfolio__add">
        <h3 className="originator-portfolio__add-title">Track an invoice</h3>
        <p className="neo-muted" style={{ fontSize: 14 }}>
          If Envio hasn&apos;t indexed your registration yet, paste the docHash here — status is read
          live from InvoiceRegistry.
        </p>
        <div className="originator-portfolio__add-row">
          <input
            className="neo-input"
            type="text"
            placeholder="0x… invoiceId (bytes32)"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
          />
          <NeoButton variant="secondary" onClick={addManualInvoice}>
            Add invoice
          </NeoButton>
        </div>
        {manualError && <p className="error">{manualError}</p>}
      </NeoCard>

      {loading && <p>Loading indexer…</p>}
      {data?.error && (
        <NeoCard className="tx-feedback tx-feedback--error">
          <p className="tx-feedback__message">Indexer: {data.error}</p>
          <p className="neo-muted" style={{ fontSize: 13 }}>
            Pinned / manual invoices still work via on-chain reads.
          </p>
        </NeoCard>
      )}

      {!loading && portfolio.length === 0 && !data?.error && (
        <NeoCard>
          <p>No invoices yet for {address.slice(0, 10)}…</p>
          <p className="neo-muted">
            <Link href="/exporter">Register one</Link> or paste a docHash above if already registered.
          </p>
        </NeoCard>
      )}

      {portfolio.length > 0 && (
        <table className="neo-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Obligor</th>
              <th>On-chain status</th>
              <th>Source</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.map((inv) => (
              <PortfolioRow
                key={inv.invoiceId}
                invoice={inv}
                originator={address}
                onFinance={financeInvoice}
                finance={finance}
              />
            ))}
          </tbody>
        </table>
      )}

      {finance?.phase === 'success' && finance.txHash && (
        <NeoCard className="tx-feedback originator-portfolio__result">
          <p className="ok">
            Note issued ·{' '}
            <a href={`${explorerUrl}/tx/${finance.txHash}`} target="_blank" rel="noreferrer">
              {finance.txHash.slice(0, 14)}…
            </a>
          </p>
        </NeoCard>
      )}
      {finance?.phase === 'error' && finance.error && (
        <NeoCard className="tx-feedback tx-feedback--error originator-portfolio__result">
          <p className="tx-feedback__message">{finance.error}</p>
          <NeoButton variant="ghost" onClick={() => setFinance(null)}>
            Dismiss
          </NeoButton>
        </NeoCard>
      )}

      {data && data.duplicates.length > 0 && (
        <details className="originator-portfolio__dupes">
          <summary>Duplicate attempts ({data.duplicates.length})</summary>
          <ul>
            {data.duplicates.map((d) => (
              <li key={d.invoiceId}>
                <code>{shortHash(d.invoiceId as Hex)}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
