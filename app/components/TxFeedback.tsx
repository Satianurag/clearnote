'use client'

import { useEffect, useRef } from 'react'
import { formatTxError } from '@/hooks/useContractTx'
import { useToast } from '@/context/ToastContext'

type TxFeedbackProps = {
  error: Error | null
  onDismiss?: () => void
  onRetry?: () => void
  retryLabel?: string
}

/** Surfaces contract / wallet errors as bottom-right toasts (no inline card). */
export function TxFeedback({
  error,
  onDismiss,
  onRetry,
  retryLabel = 'Try again',
}: TxFeedbackProps) {
  const { error: showError } = useToast()
  const lastMessage = useRef<string | null>(null)
  const onDismissRef = useRef(onDismiss)
  const onRetryRef = useRef(onRetry)

  onDismissRef.current = onDismiss
  onRetryRef.current = onRetry

  useEffect(() => {
    if (!error) {
      lastMessage.current = null
      return
    }
    const message = formatTxError(error)
    if (lastMessage.current === message) return
    lastMessage.current = message

    showError(message, {
      action: onRetryRef.current
        ? {
            label: retryLabel,
            onClick: () => {
              onRetryRef.current?.()
              onDismissRef.current?.()
            },
          }
        : undefined,
      onClose: () => onDismissRef.current?.(),
    })
  }, [error, retryLabel, showError])

  return null
}
