'use client'

import { useState } from 'react'
import { useErrorToast } from '@/hooks/useErrorToast'

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

  useErrorToast(error)

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
      <div className="apass-lookup__row">
        <input
          type="text"
          className="apass-lookup__input"
          placeholder="0x… wallet address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <button type="button" onClick={lookup} disabled={loading || !address.trim()}>
          {loading ? 'Querying…' : 'Query A-Pass'}
        </button>
      </div>
      {result && (
        <pre className="code-block">{JSON.stringify(result, null, 2)}</pre>
      )}
    </div>
  )
}
