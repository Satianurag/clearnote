'use client'

import { useEffect } from 'react'
import { NeoButton } from '@/components/neo/NeoButton'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="app-shell-error">
      <h1>Something went wrong</h1>
      <p className="neo-muted">An unexpected error occurred. Your wallet session is still safe — try again.</p>
      {error.digest && (
        <p className="neo-muted">
          Reference: <code>{error.digest}</code>
        </p>
      )}
      <NeoButton onClick={reset}>Try again</NeoButton>
    </div>
  )
}
