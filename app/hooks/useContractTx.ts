'use client'

import { useEffect } from 'react'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'
import { useTxActivity } from '@/context/TxActivityContext'
import { formatTxError } from '@/lib/tx-errors'

export type TxPhase = 'idle' | 'signing' | 'confirming' | 'success' | 'error'

export { formatTxError, decodeTxError } from '@/lib/tx-errors'

/**
 * Unified write + wait lifecycle so buttons never stick in loading after reject/revert.
 * Wagmi pattern: isPending = wallet prompt; receipt hook = on-chain confirmation.
 */
export function useContractTx() {
  const { trackTx } = useTxActivity()
  const { writeContract, data: txHash, isPending: isSigning, error: writeError, reset } =
    useWriteContract()

  useEffect(() => {
    if (txHash) trackTx(txHash)
  }, [txHash, trackTx])

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
