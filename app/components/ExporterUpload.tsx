'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { getAddress, isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { TxFeedback } from '@/components/TxFeedback'
import { useContractTx } from '@/hooks/useContractTx'
import { addresses, explorerUrl } from '@/lib/config'
import { invoiceRegistryAbi } from '@/lib/contracts'
import { currencyToBytes3, issueDateToDueTimestamp } from '@/lib/pint/parse'

type ValidateResponse = {
  docHash: `0x${string}`
  pintProfileHash: `0x${string}` | null
  validation: { ok: boolean; errors: string[]; method: string }
  excluded: string[]
  fields: {
    invoiceId: string | null
    profileId: string | null
    customizationId: string | null
    issueDate: string | null
    currency: string | null
    faceValue: number | null
    obligorName: string | null
  }
}

type Step = 'idle' | 'validating' | 'validated' | 'error'

function registerButtonLabel(phase: string): string {
  if (phase === 'signing') return 'Confirm in wallet…'
  if (phase === 'confirming') return 'Registering on-chain…'
  return 'Register on InvoiceRegistry'
}

export function ExporterUpload() {
  const { address } = useAccount()
  const [fileName, setFileName] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [localError, setLocalError] = useState<string | null>(null)
  const [validated, setValidated] = useState<ValidateResponse | null>(null)
  const [obligor, setObligor] = useState('')
  const [faceValue, setFaceValue] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [currency, setCurrency] = useState('SGD')

  const {
    writeContract,
    txHash,
    phase,
    isBusy,
    isSuccess: txSuccess,
    error: txError,
    reset,
  } = useContractTx()

  const validateFile = useCallback(
    async (file: File) => {
      setStep('validating')
      setLocalError(null)
      setValidated(null)
      reset()

      const xml = await file.text()
      const res = await fetch('/api/pint/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xml }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Validation failed (${res.status})`)
      }

      const data = (await res.json()) as ValidateResponse
      setValidated(data)
      setFaceValue(data.fields.faceValue != null ? String(data.fields.faceValue) : '')
      setDueDate(String(issueDateToDueTimestamp(data.fields.issueDate)))
      setCurrency(data.fields.currency ?? 'SGD')
      setStep(data.validation.ok ? 'validated' : 'error')
      if (!data.validation.ok) {
        setLocalError(data.validation.errors.join(' · '))
      }
      if (!data.pintProfileHash) {
        setLocalError('Missing ProfileID or CustomizationID in invoice XML.')
        setStep('error')
      }
    },
    [reset],
  )

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    try {
      await validateFile(file)
    } catch (err) {
      setStep('error')
      setLocalError(err instanceof Error ? err.message : 'Validation failed')
    }
  }

  function registerOnChain() {
    if (!validated?.docHash || !validated.pintProfileHash || !address) return
    if (!isAddress(obligor)) {
      setLocalError('Enter a valid obligor wallet address (0x…).')
      setStep('error')
      return
    }

    const face = BigInt(faceValue || '0')
    const due = BigInt(dueDate || '0')
    if (face <= BigInt(0) || due <= BigInt(0)) {
      setLocalError('Face value and due date must be positive.')
      setStep('error')
      return
    }

    setLocalError(null)
    reset()

    writeContractRegister(face, due)
  }

  function writeContractRegister(face: bigint, due: bigint) {
    if (!validated?.docHash || !validated.pintProfileHash || !address) return

    writeContract({
      address: addresses.registry,
      abi: invoiceRegistryAbi,
      functionName: 'register',
      args: [
        {
          docHash: validated.docHash,
          pintProfileHash: validated.pintProfileHash,
          originator: address,
          obligor: getAddress(obligor),
          faceValue: face,
          dueDate: due,
          registeredAt: BigInt(0),
          currency: currencyToBytes3(currency),
          status: 0,
        },
      ],
    })
  }

  if (txSuccess && txHash) {
    return (
      <NeoCard className="exporter-upload exporter-upload--success">
        <h2 className="neo-heading">Invoice registered</h2>
        <p className="neo-muted">
          docHash <code>{validated?.docHash}</code> is on InvoiceRegistry. Obligor must accept next (EIP-712).
        </p>
        <p className="exporter-upload__next">
          <Link
            href={`/obligor?invoice=${validated?.docHash ?? ''}`}
            className="neo-btn neo-btn--primary"
          >
            Send to obligor accept →
          </Link>
        </p>
        <p>
          <a href={`${explorerUrl}/tx/${txHash}`} target="_blank" rel="noreferrer">
            View transaction →
          </a>
        </p>
        <NeoButton
          variant="secondary"
          onClick={() => {
            setStep('idle')
            setValidated(null)
            setFileName(null)
            setLocalError(null)
            reset()
          }}
        >
          Upload another
        </NeoButton>
      </NeoCard>
    )
  }

  return (
    <div className="exporter-upload">
      <NeoCard>
        <h2 className="neo-heading">1 · Upload PINT-SG XML</h2>
        <p className="neo-muted">
          Canonical hash excludes PayeeParty, UUID, IssueTime, and Signature. Use a new invoice ID for each
          registration — duplicate docHash reverts on-chain.
        </p>
        <p className="exporter-upload__sample">
          <a href="/samples/PINT-SG-demo-trade-invoice.xml" download>
            Download real PINT-SG demo invoice
          </a>
          {' '}
          — Pacific Rim Electronics → Demo Obligor, SGD 125,000 (Odoo PINT-SG structure)
        </p>
        <label className="exporter-upload__file">
          <span className="neo-btn neo-btn--secondary">Choose XML file</span>
          <input type="file" accept=".xml,text/xml,application/xml" onChange={onFileChange} hidden />
          {fileName && <span className="exporter-upload__filename">{fileName}</span>}
        </label>
        {step === 'validating' && <p className="neo-muted">Validating & hashing…</p>}
      </NeoCard>

      {validated && (
        <NeoCard className="exporter-upload__details">
          <h2 className="neo-heading">2 · Review & register</h2>
          <dl className="exporter-upload__meta">
            <div>
              <dt>Invoice ID</dt>
              <dd>{validated.fields.invoiceId ?? '—'}</dd>
            </div>
            <div>
              <dt>Obligor (party name)</dt>
              <dd>{validated.fields.obligorName ?? '—'}</dd>
            </div>
            <div>
              <dt>docHash</dt>
              <dd>
                <code>{validated.docHash}</code>
              </dd>
            </div>
            <div>
              <dt>Excluded from hash</dt>
              <dd>{validated.excluded.join(', ') || 'none'}</dd>
            </div>
          </dl>

          <div className="exporter-upload__form">
            <label>
              Obligor wallet (0x…)
              <input
                className="neo-input"
                placeholder="0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b"
                value={obligor}
                onChange={(e) => setObligor(e.target.value)}
                disabled={isBusy}
              />
            </label>
            <label>
              Face value
              <input
                className="neo-input"
                type="number"
                min={1}
                value={faceValue}
                onChange={(e) => setFaceValue(e.target.value)}
                disabled={isBusy}
              />
            </label>
            <label>
              Due date (unix seconds)
              <input
                className="neo-input"
                type="number"
                min={1}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isBusy}
              />
            </label>
            <label>
              Currency
              <input
                className="neo-input"
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                disabled={isBusy}
              />
            </label>
          </div>

          <p className="neo-muted exporter-upload__originator">
            Originator (your wallet): <code>{address}</code>
          </p>

          <NeoButton
            disabled={!validated.validation.ok || isBusy}
            onClick={registerOnChain}
          >
            {registerButtonLabel(phase)}
          </NeoButton>
        </NeoCard>
      )}

      {localError && (
        <NeoCard className="exporter-upload__error">
          <p>{localError}</p>
        </NeoCard>
      )}

      <TxFeedback
        error={txError}
        onDismiss={() => reset()}
        onRetry={() => {
          reset()
          registerOnChain()
        }}
      />
    </div>
  )
}
