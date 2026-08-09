'use client'

import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { chainId } from '@/lib/config'
import { monadTestnet } from '@/wagmi.config'

export function WalletBanner() {
  const { address } = useAccount()
  const currentChain = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const onMonad = currentChain === chainId

  return (
    <div className="wallet-banner">
      {address && (
        <p className="neo-muted">
          Connected: <code className="neo-code">{address}</code>
        </p>
      )}
      {!onMonad && (
        <div className="neo-alert neo-alert--error">
          Wrong network ({currentChain}). Monad testnet ({chainId}) required.
          <button
            type="button"
            className="neo-btn neo-btn--secondary neo-btn--sm wallet-banner__switch"
            disabled={isPending}
            onClick={() => switchChain({ chainId: monadTestnet.id })}
          >
            Switch network
          </button>
        </div>
      )}
    </div>
  )
}
