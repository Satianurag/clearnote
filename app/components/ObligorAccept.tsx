'use client'

import Link from 'next/link'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { getAddress, type Hex } from 'viem'
import {
  useReadContract,
  useSignTypedData,
} from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { TxFeedback } from '@/components/TxFeedback'
import { useContractTx } from '@/hooks/useContractTx'
import { useWalletSession } from '@/hooks/useWalletSession'
import { addresses, explorerUrl } from '@/lib/config'
import { invoiceRegistryAbi } from '@/lib/contracts'
import {
  acceptanceDeadline,
  decodeBytes3Currency,
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

function formatDueDate(unix: bigint): string {
  const ms = Number(unix) * 1000
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleDateString('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function ObligorAcceptContent() {
  const params = useSearchParams()
  const { address, isReady } = useWalletSession()
  const initialInvoice = params.get('invoice')?.trim() ?? ''

  const [invoiceInput, setInvoiceInput] = useState(initialInvoice)
  const [lookupId, setLookupId] = useState<Hex | null>(
    isBytes32(initialInvoice) ? (initialInvoice as Hex) : null,
  )
  const [error, setError] = useState<string | null>(null)

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
        <NeoCard className="obligor-flow__error">
          <p>No invoice found for this ID on InvoiceRegistry.</p>
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
                {inv.faceValue.toLocaleString()} {decodeBytes3Currency(inv.currency)}
              </dd>
            </div>
            <div>
              <dt>Due date</dt>
              <dd>{formatDueDate(inv.dueDate)}</dd>
            </div>
          </dl>

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

      {error && (
        <NeoCard className="exporter-upload__error">
          <p>{error}</p>
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
