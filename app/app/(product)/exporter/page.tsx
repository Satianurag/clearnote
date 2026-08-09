'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ExporterUpload } from '@/components/ExporterUpload'
import { OriginatorPortfolio } from '@/components/OriginatorPortfolio'
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
          <p className="product-links">
            <Link href="/exporter">Exporter upload</Link> · <Link href="/compliance/matrix">Compliance</Link>
          </p>
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
        <p className="product-links">
          <Link href="/exporter?tab=originator">Originator portfolio</Link> ·{' '}
          <Link href="/compliance/matrix">Compliance matrix</Link> · <Link href="/investor">Investor desk</Link>
        </p>
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
