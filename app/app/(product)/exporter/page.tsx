'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ExporterUpload } from '@/components/ExporterUpload'
import { OriginatorPortfolio } from '@/components/OriginatorPortfolio'
import { ProductLinks } from '@/components/ProductLinks'
import { WalletGate } from '@/components/WalletGate'

function ExporterContent() {
  const params = useSearchParams()
  const tab = params.get('tab')

  if (tab === 'originator') {
    return (
      <WalletGate
        title="Connect as originator"
        description="View your registered invoices and finance accepted ones via Safe."
      >
        <div className="product-page">
          <h1 className="product-title">Originator — portfolio</h1>
          <OriginatorPortfolio />
          <ProductLinks
            items={[
              { href: '/exporter', label: 'Exporter upload' },
              { href: '/obligor', label: 'Obligor accept' },
            ]}
          />
        </div>
      </WalletGate>
    )
  }

  return (
    <WalletGate
      title="Connect to export"
      description="Register invoices on-chain from your wallet. Monad testnet required."
    >
      <div className="product-page">
        <h1 className="product-title">Exporter — Invoice upload</h1>
        <p className="neo-muted">
          Upload PINT-SG XML → structural validation → docHash → register on InvoiceRegistry from your browser
          wallet.
        </p>
        <ExporterUpload />
        <ProductLinks
          items={[
            { href: '/exporter?tab=originator', label: 'Originator portfolio' },
            { href: '/obligor', label: 'Obligor accept' },
          ]}
        />
      </div>
    </WalletGate>
  )
}

export default function ExporterPage() {
  return (
    <Suspense fallback={<p className="neo-muted">Loading exporter…</p>}>
      <ExporterContent />
    </Suspense>
  )
}
