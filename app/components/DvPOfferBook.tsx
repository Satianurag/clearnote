'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits, parseUnits, type Address } from 'viem'
import {
  useAccount,
  useChainId,
  useReadContract,
  useReadContracts,
  useSimulateContract,
} from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { TxFeedback } from '@/components/TxFeedback'
import { formatTxError, useContractTx } from '@/hooks/useContractTx'
import { addresses, chainId, explorerUrl } from '@/lib/config'
import { dvpEscrowAbi, erc20Abi } from '@/lib/contracts'
import { monadTestnet } from '@/wagmi.config'

export type OfferView = {
  offerId: string
  maker: string
  noteToken: string
  cashToken: string
  units: string
  pricePerUnit: string
  minFill: string
  expiry: string
  remaining: string
  source: 'indexer' | 'chain'
}

type OffersPayload = {
  offers: Array<{
    id?: string
    offerId: string
    maker: string
    noteToken: string
    cashToken: string
    units: string
    pricePerUnit: string
    minFill: string
    expiry: string
  }>
  fills: Array<{ offerId: string; buyer: string; units: string }>
  error?: string
}

function cashForUnits(units: bigint, pricePerUnit: bigint): bigint {
  return (units * pricePerUnit) / parseUnits('1', 18)
}

function OfferRow({
  offer,
  buyer,
  onFilled,
}: {
  offer: OfferView
  buyer: Address
  onFilled: () => void
}) {
  const offerId = BigInt(offer.offerId)
  const remaining = BigInt(offer.remaining)
  const pricePerUnit = BigInt(offer.pricePerUnit)
  const cashNeeded = cashForUnits(remaining, pricePerUnit)
  const isOpen = remaining > BigInt(0)

  const approveCash = useSimulateContract({
    chainId: monadTestnet.id,
    address: offer.cashToken as Address,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.dvpEscrow, cashNeeded],
    account: buyer,
    query: { enabled: isOpen },
  })

  const fillSim = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.dvpEscrow,
    abi: dvpEscrowAbi,
    functionName: 'fill',
    args: [offerId, remaining],
    account: buyer,
    query: { enabled: isOpen },
  })

  const tx = useContractTx()
  const [step, setStep] = useState<'idle' | 'approve' | 'fill'>('idle')

  function runFill() {
    const req = fillSim.data?.request
    if (!req) return
    setStep('fill')
    tx.reset()
    tx.writeContract(req)
  }

  function runApprove() {
    const req = approveCash.data?.request
    if (!req) return
    setStep('approve')
    tx.reset()
    tx.writeContract(req)
  }

  useEffect(() => {
    if (tx.isSuccess && step === 'approve') {
      tx.reset()
      setStep('idle')
    }
    if (tx.isSuccess && step === 'fill') {
      onFilled()
      setStep('idle')
    }
  }, [tx.isSuccess, step, onFilled, tx])

  if (!isOpen) return null

  const expiry = new Date(Number(offer.expiry) * 1000).toLocaleString('en-SG')
  const simErr = fillSim.error ?? approveCash.error

  return (
    <tr>
      <td>
        {offer.offerId}
        {offer.source === 'chain' && <span className="portfolio-source" title="On-chain only">⛓</span>}
      </td>
      <td>
        <code>{offer.maker.slice(0, 10)}…</code>
      </td>
      <td>{formatUnits(remaining, 18)} CLINV01</td>
      <td>{formatUnits(cashNeeded, 6)} aUSDC</td>
      <td>{expiry}</td>
      <td>
        <div className="dvp-offer-row__actions">
          <NeoButton
            variant="secondary"
            disabled={!approveCash.data || tx.isBusy}
            onClick={runApprove}
          >
            {tx.isBusy && step === 'approve' ? 'Approving…' : 'Approve aUSDC'}
          </NeoButton>
          <NeoButton disabled={!fillSim.data || tx.isBusy} onClick={runFill}>
            {tx.isBusy && step === 'fill' ? 'Filling…' : 'Fill offer'}
          </NeoButton>
        </div>
        {simErr && tx.phase === 'idle' && (
          <p className="error dvp-offer-row__err">{formatTxError(simErr)}</p>
        )}
        <TxFeedback
          error={tx.error}
          onDismiss={() => {
            tx.reset()
            setStep('idle')
          }}
        />
      </td>
    </tr>
  )
}

function useOpenOffersFromChain(enabled: boolean) {
  const { data: nextId } = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.dvpEscrow,
    abi: dvpEscrowAbi,
    functionName: 'nextOfferId',
    query: { enabled },
  })

  const count = nextId != null ? Number(nextId) : 0
  const ids = useMemo(
    () => Array.from({ length: Math.min(count, 32) }, (_, i) => BigInt(i)),
    [count],
  )

  const { data: rows, isLoading } = useReadContracts({
    contracts: ids.map((id) => ({
      chainId: monadTestnet.id,
      address: addresses.dvpEscrow,
      abi: dvpEscrowAbi,
      functionName: 'offers' as const,
      args: [id] as const,
    })),
    query: { enabled: enabled && count > 0 },
  })

  const offers: OfferView[] = useMemo(() => {
    if (!rows) return []
    const out: OfferView[] = []
    rows.forEach((row, i) => {
      if (row.status !== 'success' || !row.result) return
      const [maker, noteToken, cashToken, pricePerUnit, minFill, expiry, remaining, active] =
        row.result as [
          Address,
          Address,
          Address,
          bigint,
          bigint,
          bigint,
          bigint,
          boolean,
        ]
      if (!active || remaining === BigInt(0)) return
      out.push({
        offerId: String(i),
        maker,
        noteToken,
        cashToken,
        units: remaining.toString(),
        pricePerUnit: pricePerUnit.toString(),
        minFill: minFill.toString(),
        expiry: expiry.toString(),
        remaining: remaining.toString(),
        source: 'chain',
      })
    })
    return out.reverse()
  }, [rows])

  return { offers, isLoading, nextId: count }
}

export function DvPOfferBook({ refreshKey = 0 }: { refreshKey?: number }) {
  const { address } = useAccount()
  const currentChain = useChainId()
  const onMonad = currentChain === chainId
  const [data, setData] = useState<OffersPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const chain = useOpenOffersFromChain(onMonad)

  const loadIndexer = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/indexer?op=offers&limit=25')
      const json = (await res.json()) as OffersPayload
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setData({
        offers: [],
        fills: [],
        error: e instanceof Error ? e.message : 'Failed to load offers',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadIndexer()
  }, [loadIndexer, refreshKey])

  const openOffers = useMemo(() => {
    const map = new Map<string, OfferView>()
    for (const o of data?.offers ?? []) {
      map.set(o.offerId, {
        ...o,
        remaining: o.units,
        source: 'indexer',
      })
    }
    for (const o of chain.offers) {
      const existing = map.get(o.offerId)
      if (!existing || BigInt(o.remaining) > BigInt(0)) {
        map.set(o.offerId, o)
      }
    }
    return [...map.values()].filter((o) => BigInt(o.remaining) > BigInt(0))
  }, [data?.offers, chain.offers])

  if (!address) return <p>Connect wallet to fill offers.</p>
  if (!onMonad) return <p className="error">Switch to Monad testnet first.</p>

  return (
    <section className="dvp-offer-book">
      <h3 className="dvp-section__title">Open offers (indexer + on-chain)</h3>
      <p className="neo-muted dvp-section__lead">
        Live book from Envio + DvPEscrow state · only active offers with remaining units are shown.
      </p>

      {(loading || chain.isLoading) && <p>Loading offers…</p>}
      {data?.error && (
        <NeoCard className="tx-feedback tx-feedback--error">
          <p className="tx-feedback__message">Indexer: {data.error}</p>
          <p className="neo-muted" style={{ fontSize: 13 }}>On-chain scan still runs below.</p>
        </NeoCard>
      )}

      {!loading && !chain.isLoading && openOffers.length === 0 && (
        <NeoCard>
          <p>No open offers right now.</p>
          <p className="neo-muted">Post a sell offer above (seller needs CLINV01 balance).</p>
        </NeoCard>
      )}

      {openOffers.length > 0 && (
        <table className="neo-table dvp-offer-book__table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Maker</th>
              <th>Remaining</th>
              <th>Cash</th>
              <th>Expiry</th>
              <th>Fill</th>
            </tr>
          </thead>
          <tbody>
            {openOffers.map((o) => (
              <OfferRow
                key={`${o.offerId}-${o.source}`}
                offer={o}
                buyer={address}
                onFilled={loadIndexer}
              />
            ))}
          </tbody>
        </table>
      )}

      {data && data.fills.length > 0 && (
        <details className="dvp-offer-book__fills">
          <summary>Recent fills ({data.fills.length})</summary>
          <ul>
            {data.fills.map((f, i) => (
              <li key={`${f.offerId}-${i}`}>
                Offer {f.offerId} · buyer {f.buyer.slice(0, 10)}… · {f.units} units
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="neo-muted dvp-offer-book__foot">
        Escrow <code>{addresses.dvpEscrow}</code> ·{' '}
        <a href={`${explorerUrl}/address/${addresses.dvpEscrow}`}>Monadscan</a>
        {chain.nextId > 0 && ` · scanned ${Math.min(chain.nextId, 32)} offer slots`}
      </p>
    </section>
  )
}
