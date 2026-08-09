import type { ReactNode } from 'react'
import { OnboardShell } from '@/components/OnboardShell'

export const metadata = {
  title: 'Onboard — ClearNote',
  description: 'Choose your role and connect your wallet on Monad testnet',
}

export default function OnboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="onboard-theme">
      <OnboardShell>{children}</OnboardShell>
    </div>
  )
}
