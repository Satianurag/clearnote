'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'

type ApassData = {
  tier?: string
  status?: number
  expirationTime?: number
  countries?: string[]
  cvRecordId?: string
}

type LookupResult = {
  ok: boolean
  code: unknown
  message: unknown
  data: ApassData | null
}

type GenerateResult = {
  ok: boolean
  code: unknown
  message: unknown
  data: unknown
  error?: string
}

function formatExpiry(unix?: number): string {
  if (!unix) return '—'
  return new Date(unix * 1000).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ApassGenerate() {
  const { address } = useAccount()
  const [fullName, setFullName] = useState('ClearNote Demo User')
  const [country, setCountry] = useState('SG')
  const [existing, setExisting] = useState<LookupResult | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  const checkExisting = useCallback(async () => {
    if (!address) return
    setChecking(true)
    try {
      const res = await fetch('/api/cleanverse/apass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, chain: 'monad' }),
      })
      const json = (await res.json()) as LookupResult
      setExisting(json)
    } catch {
      setExisting(null)
    } finally {
      setChecking(false)
    }
  }, [address])

  useEffect(() => {
    setExisting(null)
    setResult(null)
    setError(null)
    if (address) checkExisting()
  }, [address, checkExisting])

  async function generate() {
    if (!address) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/cleanverse/generate-apass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          chain: 'monad',
          fullName,
          country,
        }),
      })
      const json = (await res.json()) as GenerateResult
      if (!res.ok) {
        setError(json.error ?? `HTTP ${res.status}`)
        return
      }
      setResult(json)
      if (!json.ok) {
        const msg = [json.message, json.code != null ? `code ${json.code}` : null]
          .filter(Boolean)
          .join(' · ')
        setError(
          msg ||
            'Generate failed — this wallet may already have an A-Pass on Cleanverse sandbox.',
        )
      } else {
        await checkExisting()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'request failed')
    } finally {
      setLoading(false)
    }
  }

  const hasPass = Boolean(existing?.ok && existing.data)

  return (
    <NeoCard>
      <h3 style={{ marginTop: 0 }}>A-Pass (Cleanverse)</h3>
      <p className="neo-muted" style={{ fontSize: 14 }}>
        Compliance onboarding uses an existing or new A-Pass on Monad sandbox — keys stay server-side.
      </p>

      {!address ? (
        <p>Connect wallet first.</p>
      ) : (
        <>
          <p>
            Wallet: <code>{address}</code>
          </p>

          {checking && <p className="neo-muted">Checking existing A-Pass…</p>}

          {hasPass && existing?.data && (
            <div className="ok" style={{ marginBottom: 16, fontSize: 14 }}>
              <strong>Already onboarded.</strong> This wallet has an active A-Pass — you do not need to
              generate again.
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                <li>Record: {existing.data.cvRecordId ?? '—'}</li>
                <li>Tier: {existing.data.tier ?? '—'}</li>
                <li>Countries: {(existing.data.countries ?? []).join(', ') || '—'}</li>
                <li>Expires: {formatExpiry(existing.data.expirationTime)}</li>
                <li>Status: {existing.data.status === 1 ? 'active' : String(existing.data.status ?? '—')}</li>
              </ul>
            </div>
          )}

          {!hasPass && !checking && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 400 }}>
              <label>
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
              <label>
                Country (ISO-2)
                <input
                  type="text"
                  value={country}
                  maxLength={2}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
                  style={{ display: 'block', width: '100%', padding: 8, marginTop: 4 }}
                />
              </label>
              <NeoButton disabled={loading} onClick={generate}>
                {loading ? 'Generating…' : 'Generate A-Pass'}
              </NeoButton>
            </div>
          )}

          {hasPass && (
            <NeoButton variant="secondary" onClick={checkExisting} disabled={checking}>
              {checking ? 'Refreshing…' : 'Refresh A-Pass status'}
            </NeoButton>
          )}
        </>
      )}

      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
      {result && (
        <pre className="code-block" style={{ marginTop: 12, fontSize: 12 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </NeoCard>
  )
}
