export function NeoLoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="neo-skeleton" role="status" aria-live="polite" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="neo-skeleton__row" />
      ))}
    </div>
  )
}
