import type { ReactNode } from 'react'
import { Space_Grotesk, Syne } from 'next/font/google'
import { OnboardShell } from '@/components/OnboardShell'

const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
})

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-space',
})

export const metadata = {
  title: 'Get started — ClearNote',
  description: 'Choose your role and connect your wallet on Monad testnet',
}

export default function OnboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`onboard-theme ${syne.variable} ${spaceGrotesk.variable}`}>
      <OnboardShell>{children}</OnboardShell>
    </div>
  )
}
