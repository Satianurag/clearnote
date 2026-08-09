'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPublicClient, http } from 'viem'
import { useToast } from '@/context/ToastContext'
import { rpcUrl } from '@/lib/config'
import { monadTestnet } from '@/wagmi.config'

type TxActivityContextValue = {
  pendingCount: number
  trackTx: (hash: `0x${string}`) => void
}

const TxActivityContext = createContext<TxActivityContextValue | null>(null)

const receiptClient = createPublicClient({
  chain: monadTestnet,
  transport: http(rpcUrl),
})

export function TxActivityProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [pendingCount, setPendingCount] = useState(0)
  const tracked = useRef<Set<string>>(new Set())
  const receiptWaiters = useRef<Set<string>>(new Set())

  const bumpPending = useCallback((delta: number) => {
    setPendingCount((n) => Math.max(0, n + delta))
  }, [])

  const waitForReceipt = useCallback(
    (hash: `0x${string}`) => {
      const key = hash.toLowerCase()
      if (receiptWaiters.current.has(key)) return
      receiptWaiters.current.add(key)

      receiptClient
        .waitForTransactionReceipt({ hash })
        .then(() => {
          toast.success('Transaction confirmed', { hash })
        })
        .catch(() => {
          toast.error('Transaction failed or timed out', { hash })
        })
        .finally(() => {
          receiptWaiters.current.delete(key)
          if (tracked.current.has(key)) {
            tracked.current.delete(key)
            bumpPending(-1)
          }
        })
    },
    [bumpPending, toast],
  )

  const trackTx = useCallback(
    (hash: `0x${string}`) => {
      const key = hash.toLowerCase()
      if (tracked.current.has(key)) return
      tracked.current.add(key)
      bumpPending(1)
      toast.pending('Transaction submitted — waiting for confirmation', { hash })
      waitForReceipt(hash)
    },
    [bumpPending, toast, waitForReceipt],
  )

  const value = useMemo(() => ({ pendingCount, trackTx }), [pendingCount, trackTx])

  return <TxActivityContext.Provider value={value}>{children}</TxActivityContext.Provider>
}

export function useTxActivity() {
  const ctx = useContext(TxActivityContext)
  if (!ctx) {
    return { pendingCount: 0, trackTx: () => {} }
  }
  return ctx
}

export function PendingTxBadge() {
  const { pendingCount } = useTxActivity()
  if (pendingCount <= 0) return null
  return (
    <span className="pending-tx-badge" title="Transactions awaiting confirmation">
      {pendingCount} pending
    </span>
  )
}
