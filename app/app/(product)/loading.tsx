import { NeoLoadingSkeleton } from '@/components/neo/NeoLoadingSkeleton'

export default function ProductLoading() {
  return (
    <div className="product-loading" role="status" aria-live="polite">
      <NeoLoadingSkeleton rows={4} />
    </div>
  )
}
