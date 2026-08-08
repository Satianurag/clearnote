'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type InvoiceRow = {
  id: string
  status?: string
  invoiceId?: string
  registerTx?: string
  issueTx?: string
}

function ExporterContent() {
  const params = useSearchParams()
  const tab = params.get('tab')
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(tab === 'originator')

  useEffect(() => {
    if (tab !== 'originator') return
    fetch('/api/seed')
      .then((r) => r.json())
      .then((d) => setRows(d.invoices ?? []))
      .finally(() => setLoading(false))
  }, [tab])

  if (tab === 'originator') {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>Originator — portfolio</h1>
        <p className="muted">Live seed invoices from manifest · duplicate INV-011 skipped at register.</p>
        {loading ? (
          <p>Loading manifest…</p>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>invoiceId</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: '1px solid #333' }}>
                  <td>{r.id}</td>
                  <td>{r.status}</td>
                  <td>
                    <code style={{ fontSize: 11 }}>{r.invoiceId?.slice(0, 18)}…</code>
                  </td>
                  <td>
                    {r.registerTx && (
                      <a href={`https://testnet.monadscan.com/tx/${r.registerTx}`}>reg</a>
                    )}
                    {r.issueTx && (
                      <>
                        {' '}
                        · <a href={`https://testnet.monadscan.com/tx/${r.issueTx}`}>issue</a>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: 16 }}>
          <Link href="/exporter">Exporter upload</Link> · <Link href="/compliance/matrix">Compliance</Link>
        </p>
      </main>
    )
  }

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Exporter — Invoice upload</h1>
      <p>Upload PINT-SG XML → Schematron validation → docHash → register on InvoiceRegistry.</p>
      <p>
        <Link href="/exporter?tab=originator">Originator portfolio</Link> ·{' '}
        <Link href="/compliance/matrix">Compliance matrix</Link> ·{' '}
        <Link href="/investor">Investor desk</Link>
      </p>
      <p style={{ color: '#666' }}>
        Run <code>pnpm pint:hash &lt;file.xml&gt;</code> locally for docHash before MetaMask register.
      </p>
    </main>
  )
}

export default function ExporterPage() {
  return (
    <Suspense fallback={<p className="muted">Loading exporter…</p>}>
      <ExporterContent />
    </Suspense>
  )
}
