import { ActivityFeed } from '@/components/ActivityFeed'

export default function ActivityPage() {
  return (
    <div>
      <h2>Indexed activity</h2>
      <p className="muted">
        CLNOTE02 Transfer events indexed by Envio. Replaces broken Cleanverse query_txs for demo.
      </p>
      <ActivityFeed />
    </div>
  )
}
