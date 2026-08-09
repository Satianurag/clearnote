import Link from 'next/link'
import type { ReactNode } from 'react'
import { ConnectWallet } from '@/components/ConnectWallet'
import { Nav } from '@/components/Nav'

export default function ProductLayout({ children }: { children: ReactNode }) {
  return (
    <div className="product-shell">
      <header className="product-header">
        <div>
          <h1 className="product-title">
            <Link href="/" className="product-title__link">
              ClearNote
            </Link>
          </h1>
          <p className="neo-muted">Monad testnet · wallet-connected flows</p>
        </div>
        <ConnectWallet />
      </header>
      <Nav />
      <main className="product-main">{children}</main>
    </div>
  )
}
