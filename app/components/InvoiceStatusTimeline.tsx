import { INVOICE_STATUS, type InvoiceStatusCode } from '@/lib/invoice-acceptance'
import { LIFECYCLE_STEPS, LIFECYCLE_STEP_LABELS } from '@/lib/invoice-lifecycle'

type Props = {
  status: number
  compact?: boolean
}

export function InvoiceStatusTimeline({ status, compact }: Props) {
  const terminal = status === 5 || status === 6
  const terminalLabel = status === 5 ? 'Defaulted' : status === 6 ? 'Disputed' : null

  return (
    <ol
      className={`invoice-timeline${compact ? ' invoice-timeline--compact' : ''}`}
      aria-label="Invoice lifecycle"
    >
      {LIFECYCLE_STEPS.map((step) => {
        const done = !terminal && status >= step
        const current = !terminal && status === step
        const future = !terminal && status < step
        return (
          <li
            key={step}
            className={[
              'invoice-timeline__step',
              done ? 'invoice-timeline__step--done' : '',
              current ? 'invoice-timeline__step--current' : '',
              future ? 'invoice-timeline__step--future' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="invoice-timeline__dot" aria-hidden />
            <span className="invoice-timeline__label">{LIFECYCLE_STEP_LABELS[step]}</span>
          </li>
        )
      })}
      {terminal && (
        <li className="invoice-timeline__step invoice-timeline__step--terminal">
          <span className="invoice-timeline__dot" aria-hidden />
          <span className="invoice-timeline__label">{terminalLabel}</span>
        </li>
      )}
    </ol>
  )
}

type CardProps = {
  status: number
  className?: string
}

export function InvoiceStatusTimelineCard({ status, className }: CardProps) {
  const label = INVOICE_STATUS[status as InvoiceStatusCode] ?? `Unknown (${status})`
  return (
    <div className={className}>
      <p className="neo-muted neo-text-sm neo-mb-sm">
        Lifecycle · <strong>{label}</strong>
      </p>
      <InvoiceStatusTimeline status={status} compact />
    </div>
  )
}
