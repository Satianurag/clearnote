'use client'

import type { ReactNode } from 'react'
import { useSwitchChain } from 'wagmi'
import { monadTestnet } from '@/wagmi.config'
import { formatTxError } from '@/hooks/useContractTx'
import { useWalletSession } from '@/hooks/useWalletSession'
import { ConnectWallet } from './ConnectWallet'
import { NeoCard } from './neo/NeoCard'

type Props = {
  title?: string
  description?: string
  children: ReactNode
}

/** Blocks children until wallet is connected on Monad testnet. */
export function WalletGate({
  title = 'Connect your wallet',
  description = 'ClearNote runs on Monad testnet. Connect MetaMask to continue — no demo wallets or CLI.',
  children,
}: Props) {
  const { phase, currentChain } = useWalletSession()
  const { switchChain, isPending, error: switchError, reset: resetSwitch } = useSwitchChain()

  if (phase === 'restoring') {
    return (
      <NeoCard className="wallet-gate wallet-gate--restoring">
        <h2 className="neo-heading">Restoring wallet…</h2>
        <p className="neo-muted">Checking your MetaMask session. This usually takes a moment.</p>
      </NeoCard>
    )
  }

  if (phase === 'disconnected') {
    return (
      <NeoCard className="wallet-gate">
        <h2 className="neo-heading">{title}</h2>
        <p className="neo-muted">{description}</p>
        <div className="wallet-gate__actions">
          <ConnectWallet />
        </div>
      </NeoCard>
    )
  }

  if (phase === 'wrong-network') {
    return (
      <NeoCard className="wallet-gate wallet-gate--warn">
        <h2 className="neo-heading">Wrong network</h2>
        <p className="neo-muted">
          Connected to chain <strong>{currentChain}</strong>. Monad testnet ({monadTestnet.id}) is required.
        </p>
        <div className="wallet-gate__actions">
          <button
            type="button"
            className="neo-btn neo-btn--primary"
            disabled={isPending}
            onClick={() => {
              resetSwitch()
              switchChain({ chainId: monadTestnet.id })
            }}
          >
            {isPending ? 'Switching…' : 'Switch to Monad testnet'}
          </button>
          {switchError && (
            <p className="connect-wallet__error" role="alert">
              {formatTxError(switchError)}
            </p>
          )}
        </div>
      </NeoCard>
    )
  }

  return <>{children}</>
}
