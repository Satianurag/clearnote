'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { DashboardInvestorSummary } from '@/components/DashboardInvestorSummary'
import { DashboardRecentActivity } from '@/components/DashboardRecentActivity'
import { NeoCard } from '@/components/neo/NeoCard'
import { useWalletSession } from '@/hooks/useWalletSession'
import { getStoredPersona } from '@/lib/persona-session'
import { shortHash } from '@/lib/invoice-acceptance'
import { useErrorToast } from '@/hooks/useErrorToast'
import type { Hex } from 'viem'
import { addresses, chainId } from '@/lib/config'

type PendingAction = {
  type: string
  invoiceId: string
  statusLabel: string
  href: string
  label: string
}

type PendingSummary = {
  awaitObligor: number
  canFinance: number
  canSettle: number
  obligorAccept: number
  total: number
}

export function DashboardHome() {
  const { address, isReady } = useWalletSession()
  const persona = typeof window !== 'undefined' ? getStoredPersona() : null
  const [actions, setActions] = useState<PendingAction[]>([])
  const [summary, setSummary] = useState<PendingSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/pending?address=${encodeURIComponent(address)}`)
      const json = (await res.json()) as {
        actions?: PendingAction[]
        summary?: PendingSummary
        error?: string
        indexerErrors?: string[]
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setActions(json.actions ?? [])
      setSummary(json.summary ?? null)
      if (json.indexerErrors?.length) {
        setError(`Indexer partial: ${json.indexerErrors.join(' · ')}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pending actions')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (isReady && address) load()
  }, [isReady, address, load])

  const personaLabel =
    persona === 'exporter' ? 'Exporter' : persona === 'investor' ? 'Investor' : persona === 'compliance' ? 'Compliance' : null

  const obligorActions = actions.filter((a) => a.type === 'obligor_accept')
  const otherActions = actions.filter((a) => a.type !== 'obligor_accept')

  return (
    <div className="dashboard-home">
      <h2>Dashboard</h2>
      <p className="muted">
        {personaLabel
          ? `Signed in as ${personaLabel} — quick links and pending on-chain actions.`
          : 'Pick a role during onboarding to filter navigation, or connect a wallet for pending actions.'}
      </p>

      {isReady && address && (
        <div className="dashboard-home__section">
          <NeoCard className="dashboard-pending">
          <div className="dashboard-pending__head">
            <h3>Pending actions</h3>
            <button type="button" className="neo-btn neo-btn--ghost neo-btn--sm" onClick={load} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {summary && (
            <p className="neo-muted dashboard-pending__summary">
              {summary.obligorAccept > 0 && <span>{summary.obligorAccept} to accept · </span>}
              {summary.canFinance > 0 && <span>{summary.canFinance} ready to finance · </span>}
              {summary.canSettle > 0 && <span>{summary.canSettle} ready to settle · </span>}
              {summary.awaitObligor > 0 && <span>{summary.awaitObligor} awaiting obligor</span>}
              {summary.total === 0 && 'No pending items — you are caught up.'}
            </p>
          )}
          {obligorActions.length > 0 && (
            <div className="dashboard-pending__section">
              <h4 className="dashboard-pending__section-title">As obligor</h4>
              <ul className="dashboard-pending__list">
                {obligorActions.map((action) => (
                  <li key={`${action.type}-${action.invoiceId}`}>
                    <Link href={action.href} className="dashboard-pending__link">
                      <span className="dashboard-pending__label">{action.label}</span>
                      <span className="neo-muted">
                        <code>{shortHash(action.invoiceId as Hex)}</code> · {action.statusLabel}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {otherActions.length > 0 && (
            <ul className="dashboard-pending__list">
              {otherActions.map((action) => (
                <li key={`${action.type}-${action.invoiceId}`}>
                  <Link href={action.href} className="dashboard-pending__link">
                    <span className="dashboard-pending__label">{action.label}</span>
                    <span className="neo-muted">
                      <code>{shortHash(action.invoiceId as Hex)}</code> · {action.statusLabel}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </NeoCard>
        </div>
      )}

      {isReady && address && (
        <div className="dashboard-home__section">
          <DashboardInvestorSummary holder={address} />
        </div>
      )}

      {isReady && address && (
        <div className="dashboard-home__section">
          <DashboardRecentActivity address={address} />
        </div>
      )}

      {!isReady && (
        <div className="dashboard-home__section">
        <NeoCard>
          <p className="neo-muted">Connect a wallet to see invoice actions tied to your address.</p>
          <Link href="/onboard">Choose role →</Link>
        </NeoCard>
        </div>
      )}

      <div className="grid grid-2 dashboard-home__section">
        <div className="card">
          <h3>Exporter</h3>
          <p className="muted">Register PINT-SG invoices, obligor handoff, originator portfolio.</p>
          <Link href="/exporter">Open exporter →</Link>
        </div>
        <div className="card">
          <h3>Investor</h3>
          <p className="muted">Positions, DvP offer book, Cleanverse pre-flight.</p>
          <Link href="/investor">Open investor →</Link>
        </div>
        <div className="card">
          <h3>Indexed activity</h3>
          <p className="muted">ERC20 transfers (CLNOTE02, CLINV01, CLLAT01) via Envio.</p>
          <Link href={address ? `/activity?wallet=${address}` : '/activity'}>
            View activity →
          </Link>
        </div>
        <div className="card">
          <h3>Compliance matrix</h3>
          <p className="muted">Live inspect() reason codes — Cleanverse vs ClearNote.</p>
          <Link href="/compliance/matrix">Open matrix →</Link>
        </div>
      </div>

      <details className="card dashboard-home__section dashboard-home__details">
        <summary>Developer tools</summary>
        <ul className="muted dashboard-home__details-list">
          <li>
            <Link href="/debug/transfers">Wallet transfer test</Link> — CLLAT01 pre-flight demo
          </li>
          <li>
            <Link href="/debug/minidvp">MiniDvP</Link> — atomic note + aUSDC settlement
          </li>
        </ul>
      </details>

      <details className="card dashboard-home__section dashboard-home__details">
        <summary>Deployed contracts</summary>
        <ul className="muted dashboard-home__details-list">
          <li>Chain ID: {chainId}</li>
          <li>CLINV01: <code>{addresses.clinv01}</code></li>
          <li>CLNOTE02: <code>{addresses.clnote02}</code></li>
          <li>CLLAT01: <code>{addresses.cllat01}</code></li>
          <li>InvoiceRegistry: <code>{addresses.registry}</code></li>
          <li>DvP escrow: <code>{addresses.dvpEscrow}</code></li>
          <li>ClearNotePolicy: <code>{addresses.clearNotePolicy}</code></li>
          <li>Safe 2-of-3: <code>{addresses.safe}</code></li>
        </ul>
      </details>
    </div>
  )
}
