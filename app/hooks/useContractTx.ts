'use client'

import { type BaseError } from 'viem'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

export type TxPhase = 'idle' | 'signing' | 'confirming' | 'success' | 'error'

export function formatTxError(error: Error | null | undefined): string {
  if (!error) return 'Transaction failed'
  const e = error as BaseError & { shortMessage?: string; cause?: { shortMessage?: string } }
  return e.shortMessage ?? e.cause?.shortMessage ?? e.message ?? 'Transaction failed'
}

/**
 * Unified write + wait lifecycle so buttons never stick in loading after reject/revert.
 * Wagmi pattern: isPending = wallet prompt; receipt hook = on-chain confirmation.
 */
export function useContractTx() {
  const { writeContract, data: txHash, isPending: isSigning, error: writeError, reset } =
    useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess,
    isError: isReceiptError,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash })

  let phase: TxPhase = 'idle'
  if (isSigning) phase = 'signing'
  else if (isConfirming) phase = 'confirming'
  else if (isSuccess) phase = 'success'
  else if (writeError || isReceiptError) phase = 'error'

  const error = writeError ?? receiptError ?? null

  return {
    writeContract,
    txHash,
    phase,
    isBusy: isSigning || isConfirming,
    isSigning,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}
