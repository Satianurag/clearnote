'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createPublicClient, http, getAddress } from 'viem'
import { WalletComplianceCheck } from '@/components/WalletComplianceCheck'
import { NeoCard } from '@/components/neo/NeoCard'
import { REASON_CODES } from '@/lib/reasonCodes'
import { addresses, demoWallets, rpcUrl } from '@/lib/config'
import { clearNotePolicyAbi } from '@/lib/contracts'

const WALLETS = [
  { label: 'Ref: issuer', addr: demoWallets.a },
  { label: 'Ref: investor', addr: demoWallets.b },
  { label: 'Ref: investor B2', addr: demoWallets.b2 },
  { label: 'Ref: frozen', addr: demoWallets.c },
  { label: 'Ref: tier-low', addr: demoWallets.e },
  { label: 'Ref: no A-Pass', addr: demoWallets.dead },
  { label: 'Ref: sanctioned', addr: '0x1111111111111111111111111111111111111111' },
]

const REASON_ROWS = Object.entries(REASON_CODES).sort(([a], [b]) => a.localeCompare(b))
const client = createPublicClient({ transport: http(rpcUrl) })

function formatSelector(code: string): string {
  const hex = code.startsWith('0x') ? code : `0x${code}`
  return hex.length >= 10 ? hex.slice(0, 10) : hex
}

export default function ComplianceMatrixPage() {
  const [rows, setRows] = useState<Array<{ wallet: string; ok: boolean; code: string; reason: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const from = getAddress(WALLETS[1].addr)
      const amount = BigInt('1000000000000000000')
      const out: typeof rows = []
      for (const w of WALLETS) {
        const to = getAddress(w.addr)
        try {
          const [ok, code, reasonText] = await client.readContract({
            address: addresses.clearNotePolicy,
            abi: clearNotePolicyAbi,
            functionName: 'inspect',
            args: [addresses.clinv01, from, to, amount],
          })
          const sel = formatSelector(code as string)
          out.push({
            wallet: w.label,
            ok: ok as boolean,
            code: sel,
            reason:
              REASON_CODES[sel.toLowerCase()] ??
              (typeof reasonText === 'string' && reasonText.length > 0
                ? reasonText
                : ok
                  ? 'Transfer permitted'
                  : sel),
          })
        } catch (e) {
          out.push({ wallet: w.label, ok: false, code: 'error', reason: String(e) })
        }
      }
      if (!cancelled) {
        setRows(out)
        setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="product-page compliance-matrix">
      <header>
        <h1 className="product-title">Compliance matrix</h1>
        <p className="neo-muted">
          Live <code>ClearNotePolicy.inspect()</code> · CLINV01 transfer from ref investor B → each target.
        </p>
        <p className="compliance-matrix__meta neo-muted">
          Policy <code>{addresses.clearNotePolicy}</code> · token <code>{addresses.clinv01}</code>
        </p>
      </header>

      <WalletComplianceCheck />

      <NeoCard>
        <h2 className="dvp-section__title">Reference wallets</h2>
        {loading ? (
          <p className="neo-muted">Loading inspect results…</p>
        ) : (
          <table className="neo-table">
            <thead>
              <tr>
                <th>Wallet</th>
                <th>Result</th>
                <th>Selector</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.wallet}>
                  <td>{r.wallet}</td>
                  <td className={r.ok ? 'ok' : 'error'}>{r.ok ? 'PASS' : 'DENY'}</td>
                  <td><code>{r.code}</code></td>
                  <td>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </NeoCard>

      <NeoCard>
        <h2 className="dvp-section__title">Reason code registry</h2>
        <p className="neo-muted compliance-matrix__registry-note">
          Static map from <code>app/lib/reasonCodes.ts</code>
        </p>
        <table className="neo-table">
          <thead>
            <tr>
              <th>Selector</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {REASON_ROWS.map(([sel, label]) => (
              <tr key={sel}>
                <td><code>{sel}</code></td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </NeoCard>

      <p className="product-links">
        <Link href="/compliance?tab=regulator">Regulator tab</Link> ·{' '}
        <Link href="/exporter">Exporter</Link> · <Link href="/investor">Investor / DvP</Link>
      </p>
    </div>
  )
}
