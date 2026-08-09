'use client'

import { useEffect, useState } from 'react'
import { parseUnits } from 'viem'
import { useAccount, useChainId, useReadContract, useSimulateContract } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { TxFeedback } from '@/components/TxFeedback'
import { formatTxError, useContractTx } from '@/hooks/useContractTx'
import { useErrorToast, useSuccessToast } from '@/hooks/useErrorToast'
import { useMonadNetworkToast } from '@/hooks/useMonadNetworkToast'
import { addresses, chainId, explorerUrl } from '@/lib/config'
import { dvpEscrowAbi, erc20Abi } from '@/lib/contracts'
import { monadTestnet } from '@/wagmi.config'

const DEFAULT_UNITS = parseUnits('1', 18)
const DEFAULT_PRICE = parseUnits('1', 6)
const WEEK_SECS = 7 * 86_400

type PostStep = 'idle' | 'approve' | 'post'

export function DvPPostOffer({ onPosted }: { onPosted?: () => void }) {
  const { address } = useAccount()
  const currentChain = useChainId()
  const onMonad = currentChain === chainId
  const tx = useContractTx()
  const [step, setStep] = useState<PostStep>('idle')
  const [units, setUnits] = useState('1')
  const [price, setPrice] = useState('1')
  const [minFill, setMinFill] = useState('1')
  const [postedMsg, setPostedMsg] = useState<string | null>(null)

  const parsedUnits = (() => {
    try {
      return parseUnits(units || '0', 18)
    } catch {
      return BigInt(0)
    }
  })()

  const parsedPrice = (() => {
    try {
      return parseUnits(price || '0', 6)
    } catch {
      return BigInt(0)
    }
  })()

  const parsedMinFill = (() => {
    try {
      return parseUnits(minFill || '0', 18)
    } catch {
      return BigInt(0)
    }
  })()

  const expiry = BigInt(Math.floor(Date.now() / 1000) + WEEK_SECS)

  const noteBal = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.clinv01,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && onMonad) },
  })

  const approveNote = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.clinv01,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.dvpEscrow, parsedUnits > BigInt(0) ? parsedUnits : DEFAULT_UNITS],
    account: address,
    query: {
      enabled: Boolean(address && onMonad && parsedUnits > BigInt(0)),
    },
  })

  const postOffer = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.dvpEscrow,
    abi: dvpEscrowAbi,
    functionName: 'postOffer',
    args: [
      addresses.clinv01,
      addresses.cashToken,
      parsedUnits > BigInt(0) ? parsedUnits : DEFAULT_UNITS,
      parsedPrice > BigInt(0) ? parsedPrice : DEFAULT_PRICE,
      parsedMinFill > BigInt(0) ? parsedMinFill : DEFAULT_UNITS,
      expiry,
    ],
    account: address,
    query: {
      enabled: Boolean(
        address &&
          onMonad &&
          parsedUnits > BigInt(0) &&
          parsedPrice > BigInt(0) &&
          parsedMinFill > BigInt(0),
      ),
    },
  })

  const simErr = postOffer.error ?? approveNote.error
  const simErrMsg = simErr && tx.phase === 'idle' ? formatTxError(simErr) : null

  useMonadNetworkToast()
  useSuccessToast(postedMsg)
  useErrorToast(simErrMsg)

  useEffect(() => {
    if (tx.isSuccess && step === 'approve') {
      tx.reset()
      setStep('idle')
    }
    if (tx.isSuccess && step === 'post') {
      setPostedMsg('Offer posted — book updates automatically.')
      onPosted?.()
      setStep('idle')
    }
  }, [tx.isSuccess, step, onPosted, tx])

  if (!address) return null
  if (!onMonad) {
    return <p className="neo-muted">Connect wallet on Monad testnet to continue.</p>
  }

  const hasBalance = (noteBal.data ?? BigInt(0)) >= parsedUnits

  function run(stepName: PostStep, req: Parameters<typeof tx.writeContract>[0] | undefined) {
    if (!req) return
    setStep(stepName)
    tx.reset()
    tx.writeContract(req)
  }

  function labelFor(s: PostStep, idle: string): string {
    if (step !== s || !tx.isBusy) return idle
    if (tx.isSigning) return 'Confirm in wallet…'
    if (tx.isConfirming) return 'Confirming…'
    return idle
  }

  return (
    <NeoCard className="dvp-post-offer">
      <h3 className="dvp-section__title">Post sell offer (seller)</h3>
      <p className="neo-muted dvp-section__lead">
        List CLINV01 for aUSDC on DvPEscrow · you need note balance + approve before posting.
      </p>
      <p className="dvp-section__meta">
        Balance: {noteBal.data != null ? `${Number(noteBal.data) / 1e18} CLINV01` : '…'}
        {!hasBalance && parsedUnits > BigInt(0) && (
          <span className="error"> — insufficient for {units} unit(s)</span>
        )}
      </p>

      <div className="dvp-post-offer__form">
        <label>
          Units (CLINV01)
          <input
            className="neo-input"
            type="text"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
          />
        </label>
        <label>
          Price per unit (aUSDC)
          <input
            className="neo-input"
            type="text"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Min fill (CLINV01)
          <input
            className="neo-input"
            type="text"
            value={minFill}
            onChange={(e) => setMinFill(e.target.value)}
          />
        </label>
      </div>

      <div className="dvp-post-offer__actions">
        <NeoButton
          variant="secondary"
          disabled={!approveNote.data || tx.isBusy || !hasBalance}
          onClick={() => run('approve', approveNote.data?.request)}
        >
          {labelFor('approve', '1. Approve CLINV01')}
        </NeoButton>
        <NeoButton
          disabled={!postOffer.data || tx.isBusy || !hasBalance}
          onClick={() => run('post', postOffer.data?.request)}
        >
          {labelFor('post', '2. Post offer')}
        </NeoButton>
      </div>

      <TxFeedback
        error={tx.error}
        onDismiss={() => {
          tx.reset()
          setStep('idle')
        }}
      />
      <p className="neo-muted neo-text-xs neo-mt-sm">
        Escrow: <code>{addresses.dvpEscrow}</code> ·{' '}
        <a href={`${explorerUrl}/address/${addresses.dvpEscrow}`}>Monadscan</a>
      </p>
    </NeoCard>
  )
}
