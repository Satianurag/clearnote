'use client'

import { useState } from 'react'
import { useAccount, useChainId, useReadContract, useSimulateContract } from 'wagmi'
import { parseUnits } from 'viem'
import { NeoButton } from '@/components/neo/NeoButton'
import { TxFeedback } from '@/components/TxFeedback'
import { useContractTx } from '@/hooks/useContractTx'
import { useErrorToast, useSuccessToast } from '@/hooks/useErrorToast'
import { useMonadNetworkToast } from '@/hooks/useMonadNetworkToast'
import { addresses, chainId } from '@/lib/config'
import { erc20Abi, miniDvpAbi } from '@/lib/contracts'
import { monadTestnet } from '@/wagmi.config'

const NOTE_AMT = parseUnits('1', 18)
const CASH_AMT = parseUnits('1', 6)

type DvpAction = 'note' | 'cash' | 'settle' | null

function formatErr(error: Error) {
  const e = error as Error & { shortMessage?: string }
  return e.shortMessage ?? e.message
}

export function MiniDvPForm() {
  const productNote = addresses.clinv01
  const currentChain = useChainId()
  const { address } = useAccount()
  const onMonad = currentChain === chainId
  const tx = useContractTx()
  const [activeAction, setActiveAction] = useState<DvpAction>(null)

  const noteBal = useReadContract({
    chainId: monadTestnet.id,
    address: productNote,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && onMonad && productNote) },
  })

  const cashBal = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.cashToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && onMonad) },
  })

  const approveNote = useSimulateContract({
    chainId: monadTestnet.id,
    address: productNote,
    abi: erc20Abi,
    functionName: 'approve',
    args: productNote ? [addresses.miniDvp, NOTE_AMT] : undefined,
    account: address,
    query: { enabled: Boolean(address && onMonad && productNote) },
  })

  const approveCash = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.cashToken,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.miniDvp, CASH_AMT],
    account: address,
    query: { enabled: Boolean(address && onMonad) },
  })

  const settle = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.miniDvp,
    abi: miniDvpAbi,
    functionName: 'settle',
    args: productNote
      ? [
          productNote,
          addresses.cashToken,
          address ?? '0x0000000000000000000000000000000000000000',
          address ?? '0x0000000000000000000000000000000000000000',
          NOTE_AMT,
          CASH_AMT,
        ]
      : undefined,
    account: address,
    query: { enabled: Boolean(address && onMonad && productNote) },
  })

  const simErr =
    settle.error ? formatErr(settle.error) :
    approveNote.error ? formatErr(approveNote.error) :
    approveCash.error ? formatErr(approveCash.error) :
    null
  const simErrMsg = simErr && tx.phase === 'idle' ? simErr : null
  const successMsg = tx.isSuccess ? 'Transaction confirmed on-chain' : null

  useMonadNetworkToast()
  useSuccessToast(successMsg)
  useErrorToast(simErrMsg)

  if (!productNote) {
    return (
      <p className="warn">
        Set <code>NEXT_PUBLIC_CLINV01</code> (WO-08 product token). MiniDvP must not use CLNOTE02 —
        untouched history token per global constraints.
      </p>
    )
  }

  if (!address) return <p>Connect wallet to use MiniDvP.</p>
  if (!onMonad) {
    return <p className="neo-muted">Connect wallet on Monad testnet to continue.</p>
  }

  function runAction(action: DvpAction, request: Parameters<typeof tx.writeContract>[0] | undefined) {
    if (!request) return
    setActiveAction(action)
    tx.reset()
    tx.writeContract(request)
  }

  function labelFor(action: DvpAction, idle: string): string {
    if (activeAction !== action || !tx.isBusy) return idle
    if (tx.isSigning) return 'Confirm in wallet…'
    if (tx.isConfirming) return 'Confirming…'
    return idle
  }

  return (
    <div>
      <p className="muted">
        Atomic settle: 1 CLINV01 + 1 aUSDC (CVA) via MiniDvP at <code>{addresses.miniDvp}</code>.
        Product flows use CLINV01 only (not CLNOTE02).
      </p>
      <p>
        CLINV01 balance: {noteBal.data?.toString() ?? '—'} · aUSDC balance:{' '}
        {cashBal.data?.toString() ?? '—'}
      </p>
      <div className="neo-btn-row">
        <NeoButton
          variant="secondary"
          disabled={!approveNote.data || tx.isBusy}
          onClick={() => runAction('note', approveNote.data?.request)}
        >
          {labelFor('note', 'Approve CLINV01')}
        </NeoButton>
        <NeoButton
          variant="secondary"
          disabled={!approveCash.data || tx.isBusy}
          onClick={() => runAction('cash', approveCash.data?.request)}
        >
          {labelFor('cash', 'Approve aUSDC')}
        </NeoButton>
        <NeoButton
          variant="secondary"
          disabled={!settle.data || tx.isBusy}
          onClick={() => runAction('settle', settle.data?.request)}
        >
          {labelFor('settle', 'Settle (MiniDvP)')}
        </NeoButton>
      </div>
      <TxFeedback
        error={tx.error}
        onDismiss={() => {
          tx.reset()
          setActiveAction(null)
        }}
      />
    </div>
  )
}
