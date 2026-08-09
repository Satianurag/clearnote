'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { chainId as monadChainId } from '@/lib/config'

export type WalletPhase = 'restoring' | 'ready' | 'wrong-network' | 'disconnected'

const RECONNECT_TIMEOUT_MS = 5_000

/**
 * Wallet session phase for UI gating.
 *
 * Root cause of "stuck on Restoring": we previously treated `connecting` the same as
 * `reconnecting`. User-initiated connect (MetaMask prompt open) sets `connecting` and
 * looked like a hung restore. WagmiProvider already auto-reconnects on mount — a second
 * `WalletReconnect` call was removed.
 */
export function useWalletSession() {
  const { address, status, isReconnecting } = useAccount()
  const currentChain = useChainId()
  const [reconnectTimedOut, setReconnectTimedOut] = useState(false)

  const isAutoReconnecting = status === 'reconnecting' || isReconnecting

  useEffect(() => {
    if (!isAutoReconnecting) {
      setReconnectTimedOut(false)
      return
    }
    const timer = window.setTimeout(() => setReconnectTimedOut(true), RECONNECT_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [isAutoReconnecting])

  const restoring = isAutoReconnecting && !reconnectTimedOut
  const onMonad = currentChain === monadChainId
  const hasAddress = Boolean(address)

  let phase: WalletPhase
  if (restoring) {
    phase = 'restoring'
  } else if (status === 'connected' && hasAddress && onMonad) {
    phase = 'ready'
  } else if (status === 'connected' && hasAddress && !onMonad) {
    phase = 'wrong-network'
  } else {
    phase = 'disconnected'
  }

  return {
    address,
    phase,
    status,
    currentChain,
    onMonad,
    isReady: phase === 'ready',
    isRestoring: phase === 'restoring',
    isConnecting: status === 'connecting',
  }
}
