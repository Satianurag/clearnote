'use client'

import { NeoButton } from '@/components/neo/NeoButton'
import { NeoCard } from '@/components/neo/NeoCard'
import { formatTxError } from '@/hooks/useContractTx'

type TxFeedbackProps = {
  error: Error | null
  onDismiss?: () => void
  onRetry?: () => void
  retryLabel?: string
}

export function TxFeedback({ error, onDismiss, onRetry, retryLabel = 'Try again' }: TxFeedbackProps) {
  if (!error) return null

  return (
    <NeoCard className="tx-feedback tx-feedback--error">
      <p className="tx-feedback__message">{formatTxError(error)}</p>
      <div className="tx-feedback__actions">
        {onRetry && (
          <NeoButton variant="secondary" onClick={onRetry}>
            {retryLabel}
          </NeoButton>
        )}
        {onDismiss && (
          <NeoButton variant="ghost" onClick={onDismiss}>
            Dismiss
          </NeoButton>
        )}
      </div>
    </NeoCard>
  )
}
