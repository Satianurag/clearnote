'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DashboardInvestorSummary } from '@/components/DashboardInvestorSummary'
import { DashboardRecentActivity } from '@/components/DashboardRecentActivity'
import { NeoCard } from '@/components/neo/NeoCard'
import { useWalletSession } from '@/hooks/useWalletSession'
import { getStoredPersona } from '@/lib/persona-session'
import type { PersonaId } from '@/lib/personas'
import {
  pendingActionAllowedForPersona,
  quickLinksForPersona,
  showDeveloperToolsForPersona,
} from '@/lib/persona-routes'
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

export function DashboardHome() {
  const { address, isReady } = useWalletSession()
  const [persona, setPersona] = useState<PersonaId | null>(null)
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useErrorToast(error)

  useEffect(() => {
    setPersona(getStoredPersona())
    const sync = () => setPersona(getStoredPersona())
    window.addEventListener('storage', sync)
    window.addEventListener('clearnote-persona', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('clearnote-persona', sync)
    }
  }, [])

  const load = useCallback(async () => {
    if (!address) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/pending?address=${encodeURIComponent(address)}`)
      const json = (await res.json()) as {
        actions?: PendingAction[]
        error?: string
        indexerErrors?: string[]
      }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setActions(json.actions ?? [])
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

  const visibleActions = useMemo(() => {
    if (!persona) return []
    return actions.filter((a) => pendingActionAllowedForPersona(persona, a.type))
  }, [actions, persona])

  const visibleSummary = useMemo(() => {
    if (!persona || visibleActions.length === 0) {
      return {
        awaitObligor: 0,
        canFinance: 0,
        canSettle: 0,
        obligorAccept: 0,
        total: 0,
      }
    }
    let awaitObligor = 0
    let canFinance = 0
    let canSettle = 0
    let obligorAccept = 0
    for (const a of visibleActions) {
      if (a.type === 'await_obligor') awaitObligor++
      if (a.type === 'finance') canFinance++
      if (a.type === 'settle') canSettle++
      if (a.type === 'obligor_accept') obligorAccept++
    }
    return { awaitObligor, canFinance, canSettle, obligorAccept, total: visibleActions.length }
  }, [persona, visibleActions])

  const quickLinks = useMemo(
    () => (persona ? quickLinksForPersona(persona, address) : []),
    [persona, address],
  )

  const obligorActions = visibleActions.filter((a) => a.type === 'obligor_accept')
  const otherActions = visibleActions.filter((a) => a.type !== 'obligor_accept')

  return (
    <div className="dashboard-home">
      <h2>Dashboard</h2>
      <p className="muted">
        {personaLabel
          ? `Signed in as ${personaLabel} — quick links and pending on-chain actions.`
          : 'Pick a role during onboarding to filter navigation, or connect a wallet for pending actions.'}
      </p>

      {isReady && address && persona && visibleActions.length > 0 && (
        <div className="dashboard-home__section">
          <NeoCard className="dashboard-pending">
          <div className="dashboard-pending__head">
            <h3>Pending actions</h3>
            <button type="button" className="neo-btn neo-btn--ghost neo-btn--sm" onClick={load} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {visibleSummary && (
            <p className="neo-muted dashboard-pending__summary">
              {visibleSummary.obligorAccept > 0 && <span>{visibleSummary.obligorAccept} to accept · </span>}
              {visibleSummary.canFinance > 0 && <span>{visibleSummary.canFinance} ready to finance · </span>}
              {visibleSummary.canSettle > 0 && <span>{visibleSummary.canSettle} ready to settle · </span>}
              {visibleSummary.awaitObligor > 0 && <span>{visibleSummary.awaitObligor} awaiting obligor</span>}
              {visibleSummary.total === 0 && 'No pending items — you are caught up.'}
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

      {isReady && address && persona === 'investor' && (
        <div className="dashboard-home__section">
          <DashboardInvestorSummary holder={address} />
        </div>
      )}

      {isReady && address && persona === 'compliance' && (
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

      {quickLinks.length > 0 && (
        <div className="grid grid-2 dashboard-home__section">
          {quickLinks.map((link) => (
            <div key={link.href} className="card">
              <h3>{link.title}</h3>
              <p className="muted">{link.description}</p>
              <Link href={link.href}>Open →</Link>
            </div>
          ))}
        </div>
      )}

      {persona && showDeveloperToolsForPersona(persona) && (
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
      )}

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
