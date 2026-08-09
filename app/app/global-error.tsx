'use client'

import { useEffect } from 'react'

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
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: 'system-ui, sans-serif',
          background: '#fffef7',
          color: '#1a1a1a',
        }}
      >
        <div className="app-shell-error" style={{ maxWidth: 480, margin: '80px auto', padding: 24 }}>
          <h1>Something went wrong</h1>
          <p style={{ color: '#444' }}>
            A critical error occurred in the app shell. Reload or try again — your wallet keys were not
            exposed.
          </p>
          {error.digest && (
            <p style={{ color: '#444', fontSize: 14 }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: '12px 20px',
              fontWeight: 700,
              border: '3px solid #000',
              background: '#ffdb33',
              boxShadow: '4px 4px 0 #000',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
