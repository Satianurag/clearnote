'use client'

import { useEffect, useState } from 'react'
import { keccak256, stringToHex, type Hex } from 'viem'
import { useReadContract } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { TxFeedback } from '@/components/TxFeedback'
import { useContractTx } from '@/hooks/useContractTx'
import { useErrorToast, useSuccessToast } from '@/hooks/useErrorToast'
import { useWalletSession } from '@/hooks/useWalletSession'
import { addresses } from '@/lib/config'
import { clearNoteControllerAbi, erc20Abi, invoiceRegistryAbi } from '@/lib/contracts'
import { isSameAddress } from '@/lib/registry'

type Props = {
  invoiceId: Hex
  originator: `0x${string}`
  obligor: `0x${string}`
  status: number
  onComplete?: () => void
}

export function RaiseDisputeAction({
  invoiceId,
  originator,
  obligor,
  status,
  onComplete,
}: Props) {
  const { address, isReady } = useWalletSession()
  const tx = useContractTx()
  const [evidence, setEvidence] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useErrorToast(error)
  useSuccessToast(successMsg)

  useEffect(() => {
    if (tx.isSuccess) {
      setSuccessMsg('Dispute raised on InvoiceRegistry')
      onComplete?.()
      tx.reset()
    }
  }, [tx.isSuccess, onComplete, tx.reset, tx])

  const isParty =
    isReady && address && (isSameAddress(address, originator) || isSameAddress(address, obligor))
  const canDispute = status >= 1 && status <= 3

  if (!canDispute) return null

  function evidenceHash(): Hex {
    const trimmed = evidence.trim()
    if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) return trimmed as Hex
    if (!trimmed) throw new Error('Enter evidence text or a bytes32 hash (0x + 64 hex)')
    return keccak256(stringToHex(trimmed))
  }

  function raiseDispute() {
    if (!address) return
    setError(null)
    setSuccessMsg(null)
    try {
      const hash = evidenceHash()
      tx.writeContract({
        address: addresses.registry,
        abi: invoiceRegistryAbi,
        functionName: 'raiseDispute',
        args: [invoiceId, hash],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispute failed')
    }
  }

  return (
    <div className="settlement-panel__dispute">
      <h4 className="settlement-panel__actions-title">Raise dispute</h4>
      <p className="neo-muted neo-text-sm">
        Originators and obligors can pause the lifecycle with on-chain evidence (hashed description or
        bytes32 audit reference).
      </p>
      {isParty ? (
        <>
          <label className="neo-field">
            <span className="neo-field__label">Evidence</span>
            <input
              className="neo-input"
              type="text"
              placeholder="Description or 0x… bytes32"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
            />
          </label>
          <NeoButton variant="ghost" disabled={tx.isBusy} onClick={raiseDispute}>
            {tx.isBusy ? 'Submitting…' : 'Raise dispute'}
          </NeoButton>
        </>
      ) : (
        <p className="neo-muted">Connect as originator or obligor to raise a dispute.</p>
      )}
      <TxFeedback error={tx.error} onDismiss={() => tx.reset()} onRetry={raiseDispute} />
    </div>
  )
}

/** Read primary holder CLINV01 balance for settle warnings. */
export function usePrimaryHolderBalance(invoiceId: Hex, enabled: boolean) {
  const { data: primaryHolder } = useReadContract({
    address: addresses.controller,
    abi: clearNoteControllerAbi,
    functionName: 'primaryHolder',
    args: [addresses.clinv01],
    query: { enabled },
  })

  const { data: balance } = useReadContract({
    address: addresses.clinv01,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [primaryHolder as `0x${string}`],
    query: { enabled: enabled && Boolean(primaryHolder) },
  })

  return balance
}
