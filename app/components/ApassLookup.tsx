'use client'

import { useState } from 'react'

type ApassResult = {
  ok: boolean
  code: unknown
  message: unknown
  data: unknown
}

export function ApassLookup() {
  const [address, setAddress] = useState('')
  const [result, setResult] = useState<ApassResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function lookup() {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/cleanverse/apass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, chain: 'monad' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        return
      }
      setResult(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <p className="muted">Query Cleanverse sandbox CVI — credentials stay server-side.</p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="0x… wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ flex: 1, minWidth: 280, padding: 8 }}
        />
        <button type="button" onClick={lookup} disabled={loading || !address.trim()}>
          {loading ? 'Querying…' : 'Query A-Pass'}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {result && (
        <pre className="code-block">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  )
}
