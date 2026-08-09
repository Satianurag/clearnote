'use client'

import { useEffect, useState } from 'react'
import { addresses, explorerUrl } from '@/lib/config'
import { useErrorToast } from '@/hooks/useErrorToast'

type OfacMeta = {
  sourceDate: string
  realCount: number
  demoCount: number
  totalCount: number
  root: string
}

export function OfacRootSummary() {
  const [meta, setMeta] = useState<OfacMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  useEffect(() => {
    fetch('/api/ofac/root')
      .then((r) => r.json())
      .then((json: OfacMeta & { error?: string }) => {
        if (json.error) throw new Error(json.error)
        setMeta(json)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load OFAC root'))
  }, [])

  if (error) {
    return <p className="neo-muted">Could not load OFAC merkle root.</p>
  }

  if (!meta) {
    return <p className="muted">Loading OFAC merkle root…</p>
  }

  return (
    <dl className="ofac-root-summary">
      <div>
        <dt>SDN publish date</dt>
        <dd>{meta.sourceDate}</dd>
      </div>
      <div>
        <dt>List entries</dt>
        <dd>
          {meta.realCount} real SDN EVM + {meta.demoCount} testnet fixtures = {meta.totalCount} leaves
        </dd>
      </div>
      <div>
        <dt>Merkle root (seed)</dt>
        <dd>
          <code title={meta.root}>{meta.root.slice(0, 14)}…{meta.root.slice(-8)}</code>
        </dd>
      </div>
      <div>
        <dt>On-chain registry</dt>
        <dd>
          <a href={`${explorerUrl}/address/${addresses.sanctions}`} target="_blank" rel="noreferrer">
            SanctionsRegistry →
          </a>
        </dd>
      </div>
    </dl>
  )
}
