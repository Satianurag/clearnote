'use client'

import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { monadTestnet } from '@/wagmi.config'

export function ConnectWallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected) {
    return (
      <button type="button" onClick={() => disconnect()}>
        Disconnect
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => connect({ connector: connectors[0], chainId: monadTestnet.id })}
    >
      {isPending ? 'Connecting…' : 'Connect MetaMask'}
    </button>
  )
}
