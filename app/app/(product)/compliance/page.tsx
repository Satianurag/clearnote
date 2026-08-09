'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuditAnchorPanel } from '@/components/AuditAnchorPanel'
import { AuditPackExports } from '@/components/AuditPackExports'
import { ApassLookup } from '@/components/ApassLookup'
import { ComplianceEventsFeed } from '@/components/ComplianceEventsFeed'
import { DenialLogPanel } from '@/components/DenialLogPanel'
import { OfacRootSummary } from '@/components/OfacRootSummary'
import { OfacVerifyChecker } from '@/components/OfacVerifyChecker'
import { NeoCard } from '@/components/neo/NeoCard'

function ComplianceContent() {
  const params = useSearchParams()
  const tab = params.get('tab')

  if (tab === 'regulator') {
    return (
      <div className="regulator-tab">
        <h2 className="product-title">Regulator — OFAC &amp; audit</h2>
        <p className="neo-muted">
          Merkle root history, verifyInclusion checker, audit packs, denial log (off-chain inspect).
        </p>

        <NeoCard className="regulator-tab__section">
          <h3 className="dvp-section__title">OFAC merkle root</h3>
          <OfacRootSummary />
        </NeoCard>

        <ComplianceEventsFeed />
        <AuditAnchorPanel />
        <DenialLogPanel />
        <OfacVerifyChecker />

        <ul className="regulator-tab__links">
          <li>
            Live compliance matrix: <Link href="/compliance/matrix">inspect() matrix</Link>
          </li>
          <li>
            System health: <a href="/api/health">/api/health</a>
          </li>
        </ul>

        <NeoCard className="regulator-tab__section">
          <h3 className="dvp-section__title">Export audit pack</h3>
          <p className="neo-muted neo-text-sm">
            On-disk packs from <code>seed/audit-packs/</code> only — no synthetic stubs. Generate
            more with <code>pnpm audit:pack INV-00N</code> from repo root.
          </p>
          <AuditPackExports />
        </NeoCard>

        <p className="neo-muted regulator-tab__foot">
          Policy denials are not on-chain (STATICCALL). Live and archived inspect() denials are
          listed above; full exports via audit packs.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="product-title">A-Pass lookup</h2>
      <p className="neo-muted">Cleanverse CVI — verify wallet eligibility on Monad sandbox.</p>
      <p>
        <Link href="/compliance/matrix">Open live compliance matrix (inspect)</Link> ·{' '}
        <Link href="/compliance?tab=regulator">Regulator tab</Link>
      </p>
      <ApassLookup />
    </div>
  )
}

export default function CompliancePage() {
  return (
    <Suspense fallback={<p className="neo-muted">Loading compliance…</p>}>
      <ComplianceContent />
    </Suspense>
  )
}
