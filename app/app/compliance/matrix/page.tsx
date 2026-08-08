'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, http, getAddress } from 'viem'
import { REASON_CODES } from '@/lib/reasonCodes'
import { addresses, demoWallets, rpcUrl } from '@/lib/config'

const RPC = rpcUrl
const POLICY = addresses.clearNotePolicy
const CLINV01 = addresses.clinv01

const WALLETS = [
  { label: 'A issuer', addr: demoWallets.a },
  { label: 'B investor', addr: demoWallets.b },
  { label: 'B2 investor', addr: demoWallets.b2 },
  { label: 'C frozen', addr: demoWallets.c },
  { label: 'E tier-low', addr: demoWallets.e },
  { label: 'No A-Pass', addr: demoWallets.dead },
  { label: 'Sanctioned', addr: '0x1111111111111111111111111111111111111111' },
]

const REASON_ROWS = Object.entries(REASON_CODES).sort(([a], [b]) => a.localeCompare(b))

const client = createPublicClient({ transport: http(RPC) })

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
            address: POLICY,
            abi: [
              {
                name: 'inspect',
                type: 'function',
                stateMutability: 'view',
                inputs: [
                  { name: 'token', type: 'address' },
                  { name: 'from', type: 'address' },
                  { name: 'to', type: 'address' },
                  { name: 'amount', type: 'uint256' },
                ],
                outputs: [
                  { name: 'ok', type: 'bool' },
                  { name: 'code', type: 'bytes4' },
                  { name: 'reason', type: 'string' },
                ],
              },
            ],
            functionName: 'inspect',
            args: [CLINV01, from, to, amount],
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
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 960 }}>
      <h1>Compliance matrix (live inspect)</h1>
      <p className="muted">
        CLINV01 transfer B → target · on-chain <code>ClearNotePolicy.inspect()</code>
      </p>
      <p style={{ fontSize: 14, color: '#888' }}>
        Policy <code>{POLICY}</code> · token <code>{CLINV01}</code>
      </p>

      {loading ? <p>Loading…</p> : (
        <table style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 32 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Wallet</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Result</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Selector</th>
              <th style={{ textAlign: 'left', padding: '8px 4px' }}>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.wallet} style={{ borderTop: '1px solid #333' }}>
                <td style={{ padding: '8px 4px' }}>{r.wallet}</td>
                <td style={{ padding: '8px 4px' }}>{r.ok ? 'PASS' : 'DENY'}</td>
                <td style={{ padding: '8px 4px' }}><code>{r.code}</code></td>
                <td style={{ padding: '8px 4px' }}>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 18 }}>Reason code registry (13)</h2>
      <p className="muted" style={{ marginBottom: 12 }}>
        Static map from <code>app/lib/reasonCodes.ts</code> — synced with services + README.
      </p>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 4px' }}>Selector</th>
            <th style={{ textAlign: 'left', padding: '8px 4px' }}>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {REASON_ROWS.map(([sel, label]) => (
            <tr key={sel} style={{ borderTop: '1px solid #333' }}>
              <td style={{ padding: '8px 4px' }}><code>{sel}</code></td>
              <td style={{ padding: '8px 4px' }}>{label}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 16 }}>
        <a href="/compliance?tab=regulator">Regulator tab</a> · <a href="/exporter">Exporter</a> ·{' '}
        <a href="/investor">Investor / DvP</a>
      </p>
    </main>
  )
}
