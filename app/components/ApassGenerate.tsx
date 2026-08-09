'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { useErrorToast } from '@/hooks/useErrorToast'

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

type ApassGenerateProps = {
  required?: boolean
  onStatusChange?: (hasPass: boolean) => void
}

export function ApassGenerate({ required, onStatusChange }: ApassGenerateProps = {}) {
  const { address } = useAccount()
  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState('SG')
  const [existing, setExisting] = useState<LookupResult | null>(null)
  const [result, setResult] = useState<GenerateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)

  useErrorToast(error)

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
    if (!fullName.trim()) {
      setError('Enter your legal name for A-Pass issuance.')
      return
    }
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

  useEffect(() => {
    onStatusChange?.(hasPass)
  }, [hasPass, onStatusChange])

  return (
    <NeoCard className="apass-generate">
      <h3 className="apass-generate__title">
        A-Pass (Cleanverse){required ? ' — required' : ''}
      </h3>
      <p className="neo-muted neo-text-md">
        {required
          ? 'Investor and compliance flows need an active A-Pass before you can trade or run inspect demos.'
          : 'Optional for exporters — generate or verify an existing A-Pass on Monad sandbox.'}
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
            <div className="ok apass-generate__ok">
              <strong>Already onboarded.</strong> This wallet has an active A-Pass — you do not need to
              generate again.
              <ul className="neo-list-disc">
                <li>Record: {existing.data.cvRecordId ?? '—'}</li>
                <li>Tier: {existing.data.tier ?? '—'}</li>
                <li>Countries: {(existing.data.countries ?? []).join(', ') || '—'}</li>
                <li>Expires: {formatExpiry(existing.data.expirationTime)}</li>
                <li>Status: {existing.data.status === 1 ? 'active' : String(existing.data.status ?? '—')}</li>
              </ul>
            </div>
          )}

          {!hasPass && !checking && (
            <div className="neo-stack-sm">
              <label className="neo-field-label">
                Full name
                <input
                  type="text"
                  className="neo-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="neo-field-label">
                Country (ISO-2)
                <input
                  type="text"
                  className="neo-input"
                  value={country}
                  maxLength={2}
                  onChange={(e) => setCountry(e.target.value.toUpperCase())}
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

      {result && (
        <pre className="code-block code-block--sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </NeoCard>
  )
}
