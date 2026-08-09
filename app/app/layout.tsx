import type { ReactNode } from 'react'
import { Providers } from './providers'
import './globals.css'

export const metadata = {
  title: 'ClearNote',
  description: 'Verified finance on Monad — compliance, DvP, indexed activity',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
