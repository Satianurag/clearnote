import type { Hex } from 'viem'
import {
  INVOICE_STATUS,
  decodeBytes3Currency,
  shortAddress,
  shortHash,
  type InvoiceStatusCode,
} from '@/lib/invoice-acceptance'
import { InvoiceStatusTimeline } from '@/components/InvoiceStatusTimeline'
import { settlementSummary } from '@/lib/invoice-lifecycle'

type Props = {
  invoiceId: Hex
  status: number
  faceValue: bigint
  dueDate: bigint
  currency: Hex | string
  obligor: `0x${string}`
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

function formatFaceValue(value: bigint, currency: string): string {
  return `${value.toLocaleString('en-SG')} ${currency}`
}

export function SettlementPanel({ invoiceId, status, faceValue, dueDate, currency, obligor }: Props) {
  const statusLabel = INVOICE_STATUS[status as InvoiceStatusCode] ?? `Unknown (${status})`
  const currencyLabel = decodeBytes3Currency(currency)
  const showSettlement = status >= 3

  if (!showSettlement) return null

  return (
    <div className="settlement-panel">
      <h3 className="dvp-section__title">Settlement &amp; maturity</h3>
      <InvoiceStatusTimeline status={status} />
      <dl className="exporter-upload__meta">
        <div>
          <dt>Registry status</dt>
          <dd>
            <span className={`obligor-flow__status obligor-flow__status--${status}`}>{statusLabel}</span>
          </dd>
        </div>
        <div>
          <dt>Invoice</dt>
          <dd>
            <code title={invoiceId}>{shortHash(invoiceId)}</code>
          </dd>
        </div>
        <div>
          <dt>Face value</dt>
          <dd>{formatFaceValue(faceValue, currencyLabel)}</dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>{formatDueDate(dueDate)}</dd>
        </div>
        <div>
          <dt>Obligor</dt>
          <dd>
            <code title={obligor}>{shortAddress(obligor)}</code>
          </dd>
        </div>
      </dl>
      <p className="neo-muted">{settlementSummary(status)}</p>
    </div>
  )
}
