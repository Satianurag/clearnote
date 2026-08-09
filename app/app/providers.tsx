'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { ToastProvider } from '@/context/ToastContext'
import { TxActivityProvider } from '@/context/TxActivityContext'
import { config } from '../wagmi.config'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <TxActivityProvider>{children}</TxActivityProvider>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
