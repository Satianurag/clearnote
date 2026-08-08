import { Nav } from '@/components/Nav'
import { ConnectWallet } from '@/components/ConnectWallet'
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
        <Providers>
          <div className="container">
            <header className="header">
              <div>
                <h1>ClearNote</h1>
                <p className="muted">Monad testnet · Cleanverse compliance · Envio indexer</p>
              </div>
              <ConnectWallet />
            </header>
            <Nav />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
