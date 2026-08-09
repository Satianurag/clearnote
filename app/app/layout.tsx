import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { fontClassName } from '@/lib/fonts'
import { Providers } from './providers'
import './globals.css'

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'ClearNote',
    template: '%s · ClearNote',
  },
  description:
    'Verified trade finance on Monad testnet — PINT-SG invoices, A-Pass compliance, obligor acceptance, DvP settlement.',
  openGraph: {
    title: 'ClearNote',
    description:
      'Verified trade finance on Monad testnet — compliance pre-flight, obligor acceptance, DvP settlement.',
    siteName: 'ClearNote',
    type: 'website',
    locale: 'en_SG',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClearNote',
    description: 'Verified trade finance on Monad testnet.',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontClassName}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
