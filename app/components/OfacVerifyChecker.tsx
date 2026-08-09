'use client'

import { useState } from 'react'
import { isAddress } from 'viem'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { useErrorToast } from '@/hooks/useErrorToast'
import { demoWallets } from '@/lib/config'

type VerifyResult = {
  address: string
  inSeedList: boolean
  merkleVerified: boolean
  sanctionedOnChain: boolean
  proofAvailable: boolean
  seedRoot: string
  onChainRoot: string | null
  rootMatches: boolean
  sourceDate: string
  totalCount: number
}

export function OfacVerifyChecker() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyResult | null>(null)

  useErrorToast(error)

  async function verify() {
    if (!isAddress(address)) {
      setError('Enter a valid 0x address')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ofac/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const json = (await res.json()) as VerifyResult & { error?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setResult(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verify failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <NeoCard className="ofac-checker">
      <h3 className="ofac-checker__title">verifyInclusion checker</h3>
      <p className="neo-muted neo-text-sm">
        Looks up the merkle proof from <code>seed/ofac/ofac-root.json</code> and calls{' '}
        <code>SanctionsRegistry.verifyInclusion</code> on Monad testnet — no mocked results.
      </p>
      <div className="ofac-checker__refs">
        <NeoButton variant="ghost" type="button" onClick={() => setAddress(demoWallets.b)}>
          Ref: investor B
        </NeoButton>
        <NeoButton variant="ghost" type="button" onClick={() => setAddress('0x098b716b8aaf21512996dc57eb0615e2383e2f96')}>
          Ref: SDN member
        </NeoButton>
      </div>
      <label className="ofac-checker__field">
        Wallet address
        <input
          type="text"
          className="ofac-checker__input"
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="0x…"
        />
      </label>
      <NeoButton className="ofac-checker__submit" disabled={loading} onClick={verify}>
        {loading ? 'Verifying…' : 'Verify on-chain'}
      </NeoButton>
      {result && (
        <div className="ofac-checker__result">
          <p className={result.merkleVerified ? 'error' : 'ok'}>
            {result.merkleVerified
              ? 'Merkle proof verifies — address is in the committed OFAC tree'
              : result.inSeedList
                ? 'In seed file but on-chain verifyInclusion returned false (root mismatch or stale commit?)'
                : 'Not in OFAC seed list — verifyInclusion false'}
          </p>
          <ul className="ofac-checker__facts">
            <li>Sanctioned flag on-chain: {result.sanctionedOnChain ? 'yes' : 'no'}</li>
            <li>Proof in seed file: {result.proofAvailable ? 'yes' : 'no'}</li>
            <li>Committed root matches seed: {result.rootMatches ? 'yes' : 'no'}</li>
            <li>SDN date: {result.sourceDate} · {result.totalCount} leaves</li>
          </ul>
        </div>
      )}
    </NeoCard>
  )
}
