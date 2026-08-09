'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { getAddress } from 'viem'
import { WalletComplianceCheck } from '@/components/WalletComplianceCheck'
import { NeoCard } from '@/components/neo/NeoCard'
import {
  COMPLIANCE_REF_WALLETS,
  inspectTransfer,
  REF_SANCTIONED,
  type InspectRow,
} from '@/lib/compliance-inspect'
import { DEFAULT_INSPECT_UNITS } from '@/lib/inspect'
import { REASON_CODE_META } from '@/lib/reasonCodes'
import { addresses } from '@/lib/config'
import { useErrorToast } from '@/hooks/useErrorToast'

const REASON_ROWS = Object.entries(REASON_CODE_META).sort(([a], [b]) => a.localeCompare(b))

function emptyRows(): InspectRow[] {
  return COMPLIANCE_REF_WALLETS.map((w) => ({
    wallet: w.label,
    to: getAddress(w.addr),
    ok: false,
    code: '…',
    reason: 'Loading…',
    enforcedBy: '…',
    layer: '…',
  }))
}

export default function ComplianceMatrixPage() {
  const [rows, setRows] = useState<InspectRow[]>(emptyRows)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  const runInspect = useCallback(async () => {
    setLoading(true)
    setError(null)
    setRows(emptyRows())

    const from = getAddress(COMPLIANCE_REF_WALLETS[1].addr)
    const amount = DEFAULT_INSPECT_UNITS

    const tasks = COMPLIANCE_REF_WALLETS.map((w, idx) =>
      inspectTransfer(w.label, getAddress(w.addr), from, amount).then((row) => {
        setRows((prev) => {
          const next = [...prev]
          next[idx] = row
          return next
        })
      }),
    )

    const results = await Promise.allSettled(tasks)
    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      setError(`${failures.length} inspect call(s) failed unexpectedly`)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    runInspect()
  }, [runInspect])

  const pendingCount = rows.filter((r) => r.code === '…').length

  return (
    <div className="product-page compliance-matrix">
      <header>
        <h1 className="product-title">Compliance matrix</h1>
        <p className="neo-muted">
          Live <code>ClearNotePolicy.inspect()</code> · CLINV01 transfer from ref investor B → each target.
        </p>
        <p className="compliance-matrix__meta neo-muted">
          Policy <code>{addresses.clearNotePolicy}</code> · token <code>{addresses.clinv01}</code>
          {' · '}
          Sanctioned ref from US Treasury SDN list (<code>{REF_SANCTIONED}</code>)
        </p>
      </header>

      <WalletComplianceCheck />

      <NeoCard>
        <div className="compliance-matrix__toolbar">
          <h2 className="dvp-section__title">Reference wallets</h2>
          <button type="button" className="neo-btn neo-btn--secondary neo-btn--sm" onClick={runInspect} disabled={loading}>
            {loading ? 'Refreshing…' : 'Retry all'}
          </button>
        </div>
        {loading && pendingCount > 0 && (
          <p className="neo-muted">
            Inspecting {COMPLIANCE_REF_WALLETS.length - pendingCount}/{COMPLIANCE_REF_WALLETS.length} wallets…
          </p>
        )}
        <table className="neo-table">
          <thead>
            <tr>
              <th scope="col">Wallet</th>
              <th scope="col">Result</th>
              <th scope="col">Selector</th>
              <th scope="col">Enforced by</th>
              <th scope="col">Layer</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.wallet}>
                <td>{r.wallet}</td>
                <td className={r.code === '…' ? 'neo-muted' : r.ok ? 'ok' : 'error'}>
                  {r.code === '…' ? '…' : r.ok ? 'PASS' : 'DENY'}
                </td>
                <td>
                  <code>{r.code}</code>
                </td>
                <td>{r.code === '…' ? '…' : r.enforcedBy}</td>
                <td className="neo-muted">{r.code === '…' ? '…' : r.layer}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </NeoCard>

      <NeoCard>
        <h2 className="dvp-section__title">Reason code registry</h2>
        <p className="neo-muted compliance-matrix__registry-note">
          Typed selectors surfaced by Cleanverse (BASE) and ClearNote policy (decorator).
        </p>
        <table className="neo-table">
          <thead>
            <tr>
              <th scope="col">Selector</th>
              <th scope="col">Meaning</th>
              <th scope="col">Enforced by</th>
              <th scope="col">Layer</th>
            </tr>
          </thead>
          <tbody>
            {REASON_ROWS.map(([sel, meta]) => (
              <tr key={sel}>
                <td>
                  <code>{sel}</code>
                </td>
                <td>{meta.label}</td>
                <td>{meta.enforcedBy}</td>
                <td className="neo-muted">{meta.layer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </NeoCard>

      <p className="product-links">
        <Link href="/compliance?tab=regulator">OFAC verifyInclusion</Link> ·{' '}
        <Link href="/activity">Indexed activity</Link> ·{' '}
        <Link href="/exporter">Exporter</Link> · <Link href="/investor">Investor / DvP</Link>
      </p>
    </div>
  )
}
