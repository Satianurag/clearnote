'use client'

import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { chainId, demoWallets } from '@/lib/config'
import { monadTestnet } from '@/wagmi.config'

export function WalletBanner() {
  const { address } = useAccount()
  const currentChain = useChainId()
  const { switchChain, isPending } = useSwitchChain()
  const onMonad = currentChain === chainId

  return (
    <div style={{ marginBottom: 20 }}>
      {address && (
        <p>
          Connected: <code>{address}</code>
        </p>
      )}
      {address && address.toLowerCase() !== demoWallets.b.toLowerCase() && (
        <p className="warn">
          Demo investor wallet B: <code>{demoWallets.b}</code>
        </p>
      )}
      {!onMonad && (
        <p className="error">
          Wrong network ({currentChain}). Monad testnet ({chainId}) required.
          <button
            type="button"
            className="btn-inline"
            disabled={isPending}
            onClick={() => switchChain({ chainId: monadTestnet.id })}
          >
            Switch network
          </button>
        </p>
      )}
    </div>
  )
}
