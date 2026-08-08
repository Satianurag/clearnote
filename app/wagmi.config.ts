import { monadTestnet as viemMonadTestnet } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { injected } from '@wagmi/core'
import { rpcUrl } from './lib/config'

// Constraints: import from viem/chains; explorer must be monadscan (not monadexplorer default).
export const monadTestnet = {
  ...viemMonadTestnet,
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'MonadScan', url: 'https://testnet.monadscan.com' },
  },
}

export const config = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    [monadTestnet.id]: http(),
  },
  ssr: false,
})
