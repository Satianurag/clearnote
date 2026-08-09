import { monadTestnet as viemMonadTestnet } from 'viem/chains'
import { createConfig, createStorage, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
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
  multiInjectedProviderDiscovery: false,
  connectors: [injected({ target: 'metaMask' })],
  transports: {
    [monadTestnet.id]: http(),
  },
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }),
  ssr: false,
})
