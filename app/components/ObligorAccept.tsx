'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAddress, type Hex } from 'viem'
import {
  useReadContract,
  useSignTypedData,
} from 'wagmi'
import { InvoiceSettlementBlock } from '@/components/InvoiceSettlementBlock'
import { InvoiceStatusTimelineCard } from '@/components/InvoiceStatusTimeline'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { TxFeedback } from '@/components/TxFeedback'
import { useErrorToast } from '@/hooks/useErrorToast'
import { useContractTx } from '@/hooks/useContractTx'
import { useWalletSession } from '@/hooks/useWalletSession'
import { addresses, explorerUrl } from '@/lib/config'
import { invoiceRegistryAbi } from '@/lib/contracts'
import {
  acceptanceDeadline,
  decodeBytes3Currency,
  formatFaceValue,
  INVOICE_STATUS,
  invoiceAcceptanceDomain,
  invoiceAcceptanceTypes,
  isBytes32,
  shortAddress,
  shortHash,
  type InvoiceStatusCode,
} from '@/lib/invoice-acceptance'

type RegistryInvoice = {
  docHash: Hex
  pintProfileHash: Hex
  originator: `0x${string}`
  obligor: `0x${string}`
  faceValue: bigint
  dueDate: bigint
  registeredAt: bigint
  currency: Hex
  status: number
}

type InboxInvoice = {
  invoiceId: string
  originator: string
  obligor: string
}

import { formatUnixDate } from '@/lib/format'

function ObligorAcceptContent() {
  const params = useSearchParams()
  const { address, isReady } = useWalletSession()
  const initialInvoice = params.get('invoice')?.trim() ?? ''

  const [invoiceInput, setInvoiceInput] = useState(initialInvoice)
  const [lookupId, setLookupId] = useState<Hex | null>(
    isBytes32(initialInvoice) ? (initialInvoice as Hex) : null,
  )
  const [error, setError] = useState<string | null>(null)
  const [inbox, setInbox] = useState<InboxInvoice[]>([])
  const [inboxLoading, setInboxLoading] = useState(false)
  const [inboxError, setInboxError] = useState<string | null>(null)

  useErrorToast(error)
  useErrorToast(inboxError ? `Inbox unavailable: ${inboxError}` : null, 'Inbox')

  const loadInbox = useCallback(async () => {
    if (!address) return
    setInboxLoading(true)
    setInboxError(null)
    try {
      const res = await fetch(
        `/api/indexer?op=invoices&obligor=${encodeURIComponent(address)}&limit=50`,
      )
      const json = (await res.json()) as { invoices?: InboxInvoice[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
      setInbox(json.invoices ?? [])
    } catch (e) {
      setInbox([])
      setInboxError(e instanceof Error ? e.message : 'Failed to load inbox')
    } finally {
      setInboxLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (isReady && address) loadInbox()
  }, [isReady, address, loadInbox])

  useEffect(() => {
    if (isBytes32(initialInvoice)) {
      setInvoiceInput(initialInvoice)
      setLookupId(initialInvoice as Hex)
    }
  }, [initialInvoice])

  const { data: invoice, isLoading, refetch } = useReadContract({
    address: addresses.registry,
    abi: invoiceRegistryAbi,
    functionName: 'get',
    args: lookupId ? [lookupId] : undefined,
    query: { enabled: Boolean(lookupId) },
  })

  const inv = invoice as RegistryInvoice | undefined
  const status = (inv?.status ?? 0) as InvoiceStatusCode
  const statusLabel = INVOICE_STATUS[status] ?? `Unknown (${status})`
  const isObligor =
    isReady && address && inv?.obligor
      ? getAddress(address) === getAddress(inv.obligor)
      : false
  const canAccept = Boolean(inv && status === 1 && isObligor)

  const { signTypedDataAsync, isPending: isSigning, reset: resetSign } = useSignTypedData()
  const tx = useContractTx()
  const isBusy = isSigning || tx.isBusy

  useEffect(() => {
    if (tx.isSuccess) loadInbox()
  }, [tx.isSuccess, loadInbox])

  const acceptButtonLabel = isSigning
    ? 'Sign in wallet…'
    : tx.isSigning
      ? 'Confirm in wallet…'
      : tx.isConfirming
        ? 'Submitting acceptance…'
        : 'Sign & accept (EIP-712)'

  const loadInvoice = useCallback(() => {
    setError(null)
    tx.reset()
    resetSign()
    const trimmed = invoiceInput.trim()
    if (!isBytes32(trimmed)) {
      setError('Enter a valid invoice ID (bytes32 hex, 0x + 64 chars).')
      setLookupId(null)
      return
    }
    setLookupId(trimmed as Hex)
  }, [invoiceInput, tx, resetSign])

  function openInboxItem(invoiceId: string) {
    setError(null)
    tx.reset()
    resetSign()
    setInvoiceInput(invoiceId)
    setLookupId(invoiceId as Hex)
  }

  async function acceptInvoice() {
    if (!lookupId || !inv || !address) return
    setError(null)
    tx.reset()
    resetSign()

    const deadline = acceptanceDeadline()
    try {
      const signature = await signTypedDataAsync({
        domain: invoiceAcceptanceDomain(addresses.registry),
        types: invoiceAcceptanceTypes,
        primaryType: 'InvoiceAcceptance',
        message: {
          invoiceId: lookupId,
          obligor: getAddress(inv.obligor),
          faceValue: inv.faceValue,
          dueDate: inv.dueDate,
          deadline,
        },
      })

      tx.writeContract({
        address: addresses.registry,
        abi: invoiceRegistryAbi,
        functionName: 'acceptByObligor',
        args: [lookupId, deadline, signature],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signature rejected or failed.')
    }
  }

  if (tx.isSuccess && tx.txHash) {
    return (
      <NeoCard className="obligor-flow obligor-flow--success">
        <span className="obligor-flow__badge">True sale confirmed</span>
        <h2 className="neo-heading">Invoice accepted on-chain</h2>
        <p className="neo-muted">
          EIP-712 signature recorded. Status is now <strong>Obligor accepted</strong> — originator can
          finance next.
        </p>
        {lookupId && (
          <p className="neo-muted">
            invoiceId <code>{shortHash(lookupId)}</code>
          </p>
        )}
        <p>
          <a href={`${explorerUrl}/tx/${tx.txHash}`} target="_blank" rel="noreferrer">
            View transaction →
          </a>
        </p>
        <div className="obligor-flow__actions">
          <Link href="/dashboard" className="neo-btn neo-btn--ghost">
            Dashboard
          </Link>
          <Link href="/exporter?tab=originator" className="neo-btn neo-btn--secondary">
            Originator portfolio
          </Link>
          <NeoButton variant="ghost" onClick={() => refetch()}>
            Refresh status
          </NeoButton>
        </div>
      </NeoCard>
    )
  }

  return (
    <div className="obligor-flow">
      {isReady && address && (
        <NeoCard className="obligor-inbox">
          <h2 className="neo-heading">Your inbox</h2>
          <p className="neo-muted">
            Pending invoices registered to you as obligor (from Envio indexer). Select one to review
            and accept.
          </p>
          {inboxLoading && <p className="neo-muted">Loading inbox…</p>}
          {!inboxLoading && !inboxError && inbox.length === 0 && (
            <p className="neo-muted">No pending invoices for {shortAddress(address)}.</p>
          )}
          {inbox.length > 0 && (
            <ul className="obligor-inbox__list">
              {inbox.map((item) => (
                <li key={item.invoiceId} className="obligor-inbox__item">
                  <div>
                    <code title={item.invoiceId}>{shortHash(item.invoiceId as Hex)}</code>
                    <span className="neo-muted obligor-inbox__from">
                      from {shortAddress(item.originator as `0x${string}`)}
                    </span>
                  </div>
                  <NeoButton variant="secondary" onClick={() => openInboxItem(item.invoiceId)}>
                    Review
                  </NeoButton>
                </li>
              ))}
            </ul>
          )}
          <NeoButton variant="ghost" onClick={loadInbox} disabled={inboxLoading}>
            {inboxLoading ? 'Refreshing…' : 'Refresh inbox'}
          </NeoButton>
        </NeoCard>
      )}

      <NeoCard>
        <span className="obligor-flow__step">Step 1</span>
        <h2 className="neo-heading">Find your invoice</h2>
        <p className="neo-muted">
          Paste the <code>docHash</code> / invoiceId from registration (same bytes32). Exporter links here
          automatically after register.
        </p>
        <div className="obligor-flow__lookup">
          <label>
            Invoice ID (bytes32)
            <input
              className="neo-input"
              placeholder="0x43895cb9bf60b29c…"
              value={invoiceInput}
              onChange={(e) => setInvoiceInput(e.target.value)}
              spellCheck={false}
            />
          </label>
          <NeoButton variant="secondary" onClick={loadInvoice}>
            Load from chain
          </NeoButton>
        </div>
      </NeoCard>

      {isLoading && lookupId && <p className="neo-muted">Reading InvoiceRegistry…</p>}

      {lookupId && !isLoading && inv && Number(inv.status) === 0 && (
        <NeoCard>
          <p className="neo-muted">No invoice found for this ID on InvoiceRegistry.</p>
        </NeoCard>
      )}

      {inv && Number(inv.status) > 0 && (
        <NeoCard className="obligor-flow__review">
          <span className="obligor-flow__step">Step 2</span>
          <h2 className="neo-heading">Review &amp; accept</h2>
          <p className="neo-muted">
            Confirm the trade receivable. Your EIP-712 signature is on-chain proof of true sale.
          </p>

          <dl className="exporter-upload__meta">
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`obligor-flow__status obligor-flow__status--${status}`}>
                  {statusLabel}
                </span>
              </dd>
            </div>
            <div>
              <dt>Invoice ID</dt>
              <dd>
                <code>{lookupId}</code>
              </dd>
            </div>
            <div>
              <dt>Originator</dt>
              <dd>
                <code title={inv.originator}>{shortAddress(inv.originator)}</code>
              </dd>
            </div>
            <div>
              <dt>Obligor (on-chain)</dt>
              <dd>
                <code title={inv.obligor}>{shortAddress(inv.obligor)}</code>
              </dd>
            </div>
            <div>
              <dt>Face value</dt>
              <dd>
                {formatFaceValue(inv.faceValue, decodeBytes3Currency(inv.currency))}
              </dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{formatUnixDate(inv.dueDate)}</dd>
            </div>
          </dl>

          <InvoiceStatusTimelineCard status={status} className="obligor-flow__timeline" />

          {status >= 3 && lookupId && (
            <InvoiceSettlementBlock
              invoiceId={lookupId}
              status={status}
              originator={inv.originator}
              obligor={inv.obligor}
              faceValue={inv.faceValue}
              dueDate={inv.dueDate}
              currency={inv.currency}
            />
          )}

          {!isReady && (
            <p className="neo-muted obligor-flow__hint">Connect wallet to continue.</p>
          )}

          {isReady && !isObligor && status === 1 && (
            <NeoCard className="obligor-flow__warn">
              <p>
                Connected wallet <code>{shortAddress(address!)}</code> is not the obligor{' '}
                <code>{shortAddress(inv.obligor)}</code>. Switch to the obligor wallet in MetaMask.
              </p>
            </NeoCard>
          )}

          {status > 1 && (
            <p className="neo-muted">
              This invoice is already past the accept step. No further obligor action needed here.
            </p>
          )}

          {canAccept && (
            <>
              <p className="neo-muted obligor-flow__signer">
                Signing as obligor: <code>{shortAddress(address!)}</code>
              </p>
              <NeoButton disabled={isBusy} onClick={acceptInvoice}>
                {acceptButtonLabel}
              </NeoButton>
            </>
          )}
        </NeoCard>
      )}

      <TxFeedback
        error={tx.error}
        onDismiss={() => tx.reset()}
        onRetry={() => {
          tx.reset()
          void acceptInvoice()
        }}
      />
    </div>
  )
}

export function ObligorAccept() {
  return (
    <Suspense fallback={<p className="neo-muted">Loading obligor flow…</p>}>
      <ObligorAcceptContent />
    </Suspense>
  )
}
