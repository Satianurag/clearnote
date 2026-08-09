'use client'

import { useCallback, useState } from 'react'
import { createSiweMessage } from 'viem/siwe'
import { getAddress, type Hex } from 'viem'
import { useSignMessage } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { useErrorToast, useSuccessToast } from '@/hooks/useErrorToast'
import { useTxActivity } from '@/context/TxActivityContext'
import { useWalletSession } from '@/hooks/useWalletSession'
import {
  markDefaultSiweStatement,
  settleSiweStatement,
  siweDomainFromWindow,
} from '@/lib/siwe'
import { isSameAddress } from '@/lib/registry'
import { monadTestnet } from '@/wagmi.config'

type SafeAction = 'settle' | 'mark-default'

type Props = {
  invoiceId: Hex
  originator: `0x${string}`
  obligor: `0x${string}`
  status: number
  dueDate: bigint
  primaryHolderBalance?: bigint
  onComplete?: () => void
}

async function runSafeIssuerAction(params: {
  invoiceId: Hex
  originator: `0x${string}`
  statement: string
  endpoint: string
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>
}) {
  const originator = getAddress(params.originator)
  const issuedAt = new Date()
  const siweMessage = createSiweMessage({
    domain: siweDomainFromWindow(),
    address: originator,
    statement: params.statement,
    uri: window.location.origin,
    version: '1',
    chainId: monadTestnet.id,
    nonce: crypto.randomUUID().replace(/-/g, ''),
    issuedAt,
    expirationTime: new Date(issuedAt.getTime() + 10 * 60 * 1000),
  })
  const siweSignature = await params.signMessageAsync({ message: siweMessage })

  const res = await fetch(params.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      invoiceId: params.invoiceId.toLowerCase(),
      originator,
      siweMessage,
      siweSignature,
    }),
  })
  const json = (await res.json()) as { error?: string; txHash?: string }
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.txHash as `0x${string}` | undefined
}

export function InvoiceSettlementActions({
  invoiceId,
  originator,
  obligor,
  status,
  dueDate,
  primaryHolderBalance,
  onComplete,
}: Props) {
  const { address, isReady } = useWalletSession()
  const { signMessageAsync } = useSignMessage()
  const { trackTx } = useTxActivity()
  const [busy, setBusy] = useState<SafeAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useErrorToast(error)
  useSuccessToast(successMsg)

  const isOriginator = isReady && address && isSameAddress(address, originator)
  const isParty =
    isReady && address && (isSameAddress(address, originator) || isSameAddress(address, obligor))
  const isFinanced = status === 3
  const isPastDue = Number(dueDate) * 1000 < Date.now()
  const notesAtPrimary = primaryHolderBalance ?? BigInt(0)

  const runAction = useCallback(
    async (action: SafeAction) => {
      if (!address) return
      setBusy(action)
      setError(null)
      setSuccessMsg(null)
      try {
        const statement =
          action === 'settle'
            ? settleSiweStatement(invoiceId)
            : markDefaultSiweStatement(invoiceId)
        const endpoint = action === 'settle' ? '/api/safe/settle' : '/api/safe/mark-default'
        const txHash = await runSafeIssuerAction({
          invoiceId,
          originator,
          statement,
          endpoint,
          signMessageAsync,
        })
        const label = action === 'settle' ? 'Invoice settled' : 'Invoice marked defaulted'
        setSuccessMsg(txHash ? `${label} — ${txHash.slice(0, 14)}…` : label)
        if (txHash) trackTx(txHash)
        onComplete?.()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Safe action failed')
      } finally {
        setBusy(null)
      }
    },
    [address, invoiceId, originator, onComplete, signMessageAsync, trackTx],
  )

  if (!isFinanced) return null

  return (
    <div className="settlement-panel__actions">
      <h4 className="settlement-panel__actions-title">Issuer actions (Safe 2-of-3)</h4>
      <p className="neo-muted neo-text-sm">
        After obligor repayment (off-chain), mark the invoice settled on-chain. If past due without
        payment, mark defaulted. Both execute via the program Safe with your SIWE authorization.
      </p>

      {notesAtPrimary === BigInt(0) && (
        <p className="neo-muted settlement-panel__warn">
          Primary holder CLINV01 balance is 0 — notes may have moved via DvP. Settle still marks the
          registry; outstanding notes with investors are not burned automatically.
        </p>
      )}

      {isOriginator ? (
        <div className="settlement-panel__buttons">
          <NeoButton
            variant="primary"
            disabled={busy !== null}
            onClick={() => runAction('settle')}
          >
            {busy === 'settle' ? 'Sign SIWE & Safe…' : 'Mark settled (repaid)'}
          </NeoButton>
          <NeoButton
            variant="secondary"
            disabled={busy !== null}
            onClick={() => runAction('mark-default')}
          >
            {busy === 'mark-default' ? 'Sign SIWE & Safe…' : 'Mark defaulted'}
          </NeoButton>
        </div>
      ) : (
        <p className="neo-muted">Connect as originator ({originator.slice(0, 10)}…) to settle.</p>
      )}

      {isPastDue && isOriginator && (
        <p className="neo-muted settlement-panel__hint">Past due date — default is available if unpaid.</p>
      )}

      {!isParty && isReady && (
        <p className="neo-muted">Only the originator or obligor can act on this invoice.</p>
      )}
    </div>
  )
}
