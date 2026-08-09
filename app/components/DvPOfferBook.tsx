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
import { useErrorToast } from '@/hooks/useErrorToast'
import { useMonadNetworkToast } from '@/hooks/useMonadNetworkToast'
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

import { cashAllowanceForFill, cashForUnits } from '@/lib/dvp-math'
import { formatTokenAmount, formatUnixDateTime } from '@/lib/format'

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
  const minFill = BigInt(offer.minFill)
  const pricePerUnit = BigInt(offer.pricePerUnit)
  const isOpen = remaining > BigInt(0)
  const isMaker = buyer.toLowerCase() === offer.maker.toLowerCase()

  const [fillUnitsStr, setFillUnitsStr] = useState(formatUnits(remaining, 18))

  useEffect(() => {
    setFillUnitsStr(formatUnits(remaining, 18))
  }, [remaining])

  const fillUnits = (() => {
    try {
      const v = parseUnits(fillUnitsStr || '0', 18)
      return v > remaining ? remaining : v
    } catch {
      return BigInt(0)
    }
  })()

  const cashNeeded = cashForUnits(fillUnits > BigInt(0) ? fillUnits : remaining, pricePerUnit)
  const approveAmount = cashAllowanceForFill(
    fillUnits > BigInt(0) ? fillUnits : remaining,
    pricePerUnit,
  )

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    chainId: monadTestnet.id,
    address: offer.cashToken as Address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [buyer, addresses.dvpEscrow],
    query: { enabled: isOpen && !isMaker },
  })

  const needsApprove = allowance === undefined ? true : allowance < approveAmount

  const approveCash = useSimulateContract({
    chainId: monadTestnet.id,
    address: offer.cashToken as Address,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.dvpEscrow, approveAmount],
    account: buyer,
    query: { enabled: isOpen && !isMaker && needsApprove && fillUnits > BigInt(0) },
  })

  const fillSim = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.dvpEscrow,
    abi: dvpEscrowAbi,
    functionName: 'fill',
    args: [offerId, fillUnits > BigInt(0) ? fillUnits : remaining],
    account: buyer,
    query: {
      enabled:
        isOpen &&
        !isMaker &&
        fillUnits > BigInt(0) &&
        fillUnits <= remaining &&
        (fillUnits >= minFill || fillUnits === remaining),
    },
  })

  const cancelSim = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.dvpEscrow,
    abi: dvpEscrowAbi,
    functionName: 'cancel',
    args: [offerId],
    account: buyer,
    query: { enabled: isOpen && isMaker },
  })

  const tx = useContractTx()
  const [step, setStep] = useState<'idle' | 'approve' | 'fill' | 'cancel'>('idle')

  const simErr = fillSim.error ?? approveCash.error ?? cancelSim.error
  const simErrMsg = simErr && tx.phase === 'idle' ? formatTxError(simErr) : null
  useErrorToast(simErrMsg)

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

  function runCancel() {
    const req = cancelSim.data?.request
    if (!req) return
    setStep('cancel')
    tx.reset()
    tx.writeContract(req)
  }

  useEffect(() => {
    if (tx.isSuccess && step === 'approve') {
      tx.reset()
      setStep('idle')
      refetchAllowance()
    }
    if (tx.isSuccess && (step === 'fill' || step === 'cancel')) {
      onFilled()
      setStep('idle')
    }
  }, [tx.isSuccess, step, onFilled, tx, refetchAllowance])

  if (!isOpen) return null

  const expiry = formatUnixDateTime(BigInt(offer.expiry))
  const fillInvalid =
    fillUnits <= BigInt(0) ||
    fillUnits > remaining ||
    (fillUnits < minFill && fillUnits !== remaining)

  return (
    <tr>
      <td>
        {offer.offerId}
        {offer.source === 'indexer' && (
          <span className="portfolio-source" title="Indexer discovery only — confirm on-chain before fill">
            idx
          </span>
        )}
      </td>
      <td>
        <code>{offer.maker.slice(0, 10)}…</code>
      </td>
      <td>{formatTokenAmount(remaining, 18)}</td>
      <td>{formatTokenAmount(minFill, 18)}</td>
      <td>{formatTokenAmount(cashNeeded, 6)} aUSDC</td>
      <td>{expiry}</td>
      <td>
        {isMaker ? (
          <NeoButton
            variant="secondary"
            disabled={!cancelSim.data || tx.isBusy}
            onClick={runCancel}
          >
            {tx.isBusy && step === 'cancel' ? 'Cancelling…' : 'Cancel offer'}
          </NeoButton>
        ) : (
          <div className="dvp-offer-row__fill">
            <label className="dvp-offer-row__fill-label">
              Fill units
              <input
                className="neo-input dvp-offer-row__fill-input"
                type="text"
                value={fillUnitsStr}
                onChange={(e) => setFillUnitsStr(e.target.value)}
              />
            </label>
            <div className="dvp-offer-row__actions">
              {needsApprove && (
                <NeoButton
                  variant="secondary"
                  disabled={!approveCash.data || tx.isBusy || fillInvalid}
                  onClick={runApprove}
                >
                  {tx.isBusy && step === 'approve' ? 'Approving…' : 'Approve aUSDC'}
                </NeoButton>
              )}
              <NeoButton
                disabled={!fillSim.data || tx.isBusy || fillInvalid}
                onClick={runFill}
              >
                {tx.isBusy && step === 'fill' ? 'Filling…' : 'Fill offer'}
              </NeoButton>
            </div>
            {fillInvalid && (
              <p className="neo-muted dvp-offer-row__hint">
                Min {formatTokenAmount(minFill, 18)} or fill entire remaining{' '}
                {formatTokenAmount(remaining, 18)}
              </p>
            )}
            {!needsApprove && !fillInvalid && (
              <p className="ok dvp-offer-row__hint">Allowance sufficient</p>
            )}
          </div>
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

function useOpenOffersFromChain(enabled: boolean, refreshKey: number) {
  const { data: nextId, refetch: refetchNextId } = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.dvpEscrow,
    abi: dvpEscrowAbi,
    functionName: 'nextOfferId',
    query: { enabled },
  })

  const count = nextId != null ? Number(nextId) : 0
  const ids = useMemo(() => {
    const n = Math.min(count, 32)
    return Array.from({ length: n }, (_, i) => BigInt(count - 1 - i))
  }, [count])

  const {
    data: rows,
    isLoading,
    refetch: refetchOffers,
  } = useReadContracts({
    contracts: ids.map((id) => ({
      chainId: monadTestnet.id,
      address: addresses.dvpEscrow,
      abi: dvpEscrowAbi,
      functionName: 'offers' as const,
      args: [id] as const,
    })),
    query: { enabled: enabled && count > 0 },
  })

  useEffect(() => {
    if (!enabled || count === 0) return
    refetchNextId()
    refetchOffers()
  }, [refreshKey, enabled, count, refetchNextId, refetchOffers])

  const offers: OfferView[] = useMemo(() => {
    if (!rows) return []
    const out: OfferView[] = []
    rows.forEach((row, i) => {
      if (row.status !== 'success' || !row.result) return
      const offerId = ids[i]
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
        offerId: String(offerId),
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
    return out
  }, [rows, ids])

  return { offers, isLoading, nextId: count, refetchOffers }
}

export function DvPOfferBook({ refreshKey = 0 }: { refreshKey?: number }) {
  const { address } = useAccount()
  const currentChain = useChainId()
  const onMonad = currentChain === chainId
  const [data, setData] = useState<OffersPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useMonadNetworkToast()
  useErrorToast(data?.error ? `Indexer: ${data.error}` : null)

  const chain = useOpenOffersFromChain(onMonad, refreshKey)

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

  const onOfferChanged = useCallback(() => {
    loadIndexer()
    chain.refetchOffers()
  }, [loadIndexer, chain])

  const openOffers = useMemo(() => {
    const fillsByOffer = new Map<string, bigint>()
    for (const f of data?.fills ?? []) {
      const cur = fillsByOffer.get(f.offerId) ?? BigInt(0)
      fillsByOffer.set(f.offerId, cur + BigInt(f.units))
    }

    const map = new Map<string, OfferView>()

    for (const o of chain.offers) {
      map.set(o.offerId, o)
    }

    for (const o of data?.offers ?? []) {
      if (map.has(o.offerId)) continue
      const filled = fillsByOffer.get(o.offerId) ?? BigInt(0)
      const original = BigInt(o.units)
      const remaining = original > filled ? original - filled : BigInt(0)
      if (remaining > BigInt(0)) {
        map.set(o.offerId, {
          ...o,
          remaining: remaining.toString(),
          source: 'indexer',
        })
      }
    }

    return [...map.values()]
      .filter((o) => BigInt(o.remaining) > BigInt(0))
      .sort((a, b) => Number(BigInt(b.offerId) - BigInt(a.offerId)))
  }, [data?.offers, data?.fills, chain.offers])

  if (!address) return <p>Connect wallet to fill offers.</p>
  if (!onMonad) {
    return <p className="neo-muted">Connect wallet on Monad testnet to continue.</p>
  }

  return (
    <section className="dvp-offer-book">
      <h3 className="dvp-section__title">Open offers (on-chain + indexer)</h3>
      <p className="neo-muted dvp-section__lead">
        On-chain state is source of truth · indexer fills discovery gaps only.
      </p>

      {(loading || chain.isLoading) && <p>Loading offers…</p>}

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
              <th scope="col">ID</th>
              <th scope="col">Maker</th>
              <th scope="col">Remaining</th>
              <th scope="col">Min fill</th>
              <th scope="col">Cash</th>
              <th scope="col">Expiry</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {openOffers.map((o) => (
              <OfferRow key={o.offerId} offer={o} buyer={address} onFilled={onOfferChanged} />
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
        {chain.nextId > 0 && ` · scanned latest ${Math.min(chain.nextId, 32)} offers`}
      </p>
    </section>
  )
}
