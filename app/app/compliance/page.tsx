'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ApassLookup } from '@/components/ApassLookup'

export default function CompliancePage() {
  const params = useSearchParams()
  const tab = params.get('tab')

  if (tab === 'regulator') {
    return (
      <div>
        <h2>Regulator — OFAC & audit</h2>
        <p className="muted">Merkle root history, audit packs, denial log (off-chain inspect).</p>
        <ul>
          <li>
            OFAC root: <code>seed/ofac/ofac-root.json</code> ·{' '}
            <a href="/api/health">health</a>
          </li>
          <li>
            Audit packs: <code>seed/audit-packs/</code> · run <code>pnpm audit:pack INV-001</code>
          </li>
          <li>
            Live compliance matrix: <Link href="/compliance/matrix">inspect() matrix</Link>
          </li>
        </ul>
        <p style={{ marginTop: 16, color: '#666' }}>
          Policy denials are not on-chain (STATICCALL). Pre-flight inspect() results are logged in audit packs.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2>A-Pass lookup</h2>
      <p className="muted">Cleanverse CVI — verify wallet eligibility on Monad sandbox.</p>
      <p>
        <Link href="/compliance/matrix">Open live compliance matrix (inspect)</Link> ·{' '}
        <Link href="/compliance?tab=regulator">Regulator tab</Link>
      </p>
      <ApassLookup />
    </div>
  )
}
