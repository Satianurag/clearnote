'use client'

import { useEffect, useRef } from 'react'
import { useChainId } from 'wagmi'
import { chainId } from '@/lib/config'
import { useToast } from '@/context/ToastContext'

/** One-shot warning when wallet is on the wrong chain (deduped globally via ToastContext). */
export function useMonadNetworkToast() {
  const current = useChainId()
  const { warning } = useToast()
  const warnedChain = useRef<number | null>(null)

  useEffect(() => {
    if (current === chainId) {
      warnedChain.current = null
      return
    }
    if (warnedChain.current === current) return
    warnedChain.current = current
    warning('Switch to Monad testnet (chain 10143) to use this feature.')
  }, [current, warning])
}
