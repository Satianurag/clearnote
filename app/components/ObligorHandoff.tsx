'use client'

import { useCallback, useMemo, useState } from 'react'
import { NeoButton } from '@/components/neo/NeoButton'

type Props = {
  invoiceId: string
  obligorName?: string | null
}

export function ObligorHandoff({ invoiceId, obligorName }: Props) {
  const [copied, setCopied] = useState(false)

  const obligorUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/obligor?invoice=${invoiceId}`
    return `${window.location.origin}/obligor?invoice=${invoiceId}`
  }, [invoiceId])

  const mailto = useMemo(() => {
    const subject = encodeURIComponent('ClearNote — invoice awaiting your acceptance')
    const body = encodeURIComponent(
      `Please review and accept this trade invoice on ClearNote:\n\n${obligorUrl}\n\nInvoice ID: ${invoiceId}`,
    )
    return `mailto:?subject=${subject}&body=${body}`
  }, [invoiceId, obligorUrl])

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(obligorUrl)}`
  const [qrFailed, setQrFailed] = useState(false)

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(obligorUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
    }
  }, [obligorUrl])

  return (
    <div className="obligor-handoff">
      <p className="neo-muted">
        Send this link to {obligorName ? <strong>{obligorName}</strong> : 'the obligor'} — they open it in
        their wallet browser to accept.
      </p>
      <p className="obligor-handoff__url">
        <code>{obligorUrl}</code>
      </p>
      <div className="obligor-handoff__actions">
        <NeoButton type="button" onClick={copyLink}>
          {copied ? 'Copied ✓' : 'Copy obligor link'}
        </NeoButton>
        <a className="neo-btn neo-btn--secondary" href={mailto}>
          Email share
        </a>
      </div>
      <div className="obligor-handoff__qr">
        {!qrFailed ? (
          <img
            src={qrSrc}
            width={160}
            height={160}
            alt="QR code for obligor acceptance link"
            onError={() => setQrFailed(true)}
          />
        ) : (
          <p className="neo-muted">QR preview unavailable — use copy link or email above.</p>
        )}
        <p className="neo-muted">Scan to open obligor accept page (served by qrserver.com)</p>
      </div>
    </div>
  )
}
