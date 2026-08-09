'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ActivityFeed } from '@/components/ActivityFeed'

function ActivityContent() {
  const params = useSearchParams()
  const wallet = params.get('wallet')?.trim() ?? undefined

  return (
    <div>
      <h2>Indexed activity</h2>
      <p className="muted">
        ERC20 transfer history from the Envio indexer — defaults to <strong>CLINV01</strong> (product
        token). CLNOTE02 is history-only; switch token filter to view it.
      </p>
      <ActivityFeed initialWallet={wallet} initialOnlyMine={Boolean(wallet)} />
    </div>
  )
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<p className="muted">Loading activity…</p>}>
      <ActivityContent />
    </Suspense>
  )
}
