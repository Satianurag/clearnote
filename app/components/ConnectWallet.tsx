'use client'

import { useEffect, useState } from 'react'
import { useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { monadTestnet } from '@/wagmi.config'
import { formatTxError } from '@/hooks/useContractTx'
import { useErrorToast } from '@/hooks/useErrorToast'
import { useWalletSession } from '@/hooks/useWalletSession'

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function ConnectWallet() {
  const [mounted, setMounted] = useState(false)
  const { address, phase } = useWalletSession()
  const { connect, connectors, isPending, error: connectError, reset: resetConnect } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching, error: switchError, reset: resetSwitch } = useSwitchChain()

  useEffect(() => setMounted(true), [])

  useErrorToast(connectError ? formatTxError(connectError) : null, 'Wallet')
  useErrorToast(switchError ? formatTxError(switchError) : null, 'Network')

  const metaMask = connectors.find((c) => c.id === 'metaMask') ?? connectors[0]

  if (!mounted) {
    return <span className="connect-wallet__status">Connect MetaMask</span>
  }

  if (phase === 'restoring') {
    return <span className="connect-wallet__status">Restoring wallet…</span>
  }

  if (phase === 'ready' && address) {
    return (
      <div className="connect-wallet connect-wallet--ready">
        <span className="connect-wallet__badge">Connected</span>
        <span className="connect-wallet__addr" title={address}>
          {shortAddress(address)}
        </span>
        <button type="button" className="neo-btn neo-btn--ghost neo-btn--sm" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  if (phase === 'wrong-network' && address) {
    return (
      <div className="connect-wallet">
        <span className="connect-wallet__addr" title={address}>
          {shortAddress(address)}
        </span>
        <button
          type="button"
          className="neo-btn neo-btn--secondary neo-btn--sm"
          disabled={switching}
          onClick={() => {
            resetSwitch()
            switchChain({ chainId: monadTestnet.id })
          }}
        >
          {switching ? 'Switching…' : 'Switch to Monad'}
        </button>
        <button type="button" className="neo-btn neo-btn--ghost neo-btn--sm" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="connect-wallet connect-wallet--prompt">
      <button
        type="button"
        className="neo-btn neo-btn--primary"
        disabled={isPending || !metaMask}
        onClick={() => {
          resetConnect()
          if (metaMask) connect({ connector: metaMask, chainId: monadTestnet.id })
        }}
      >
        {isPending ? 'Connecting…' : 'Connect MetaMask'}
      </button>
    </div>
  )
}
