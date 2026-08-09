import { ObligorAccept } from '@/components/ObligorAccept'
import { ProductLinks } from '@/components/ProductLinks'
import { WalletGate } from '@/components/WalletGate'

export default function ObligorPage() {
  return (
    <WalletGate
      title="Connect as obligor"
      description="Accept a registered invoice with an EIP-712 signature. Monad testnet · obligor wallet required."
    >
      <div className="product-page">
        <header className="obligor-hero">
          <span className="obligor-hero__tag">Buyer confirmation</span>
          <h1 className="product-title">Obligor — Accept invoice</h1>
          <p className="neo-muted">
            True-sale evidence on-chain. Sign once to confirm the trade receivable is valid before
            financing.
          </p>
        </header>
        <ObligorAccept />
        <ProductLinks
          items={[
            { href: '/exporter', label: 'Exporter upload' },
            { href: '/exporter?tab=originator', label: 'Originator portfolio' },
          ]}
        />
      </div>
    </WalletGate>
  )
}
