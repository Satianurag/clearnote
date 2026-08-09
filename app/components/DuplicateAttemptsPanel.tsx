'use client'

import type { IndexerDuplicate } from '@/lib/indexer'
import { shortHash } from '@/lib/invoice-acceptance'
import type { Hex } from 'viem'

type Props = {
  duplicates: IndexerDuplicate[]
  title?: string
}

export function DuplicateAttemptsPanel({ duplicates, title = 'Duplicate registration attempts' }: Props) {
  if (duplicates.length === 0) return null

  return (
    <details className="duplicate-attempts" open={duplicates.length <= 3}>
      <summary>
        {title} ({duplicates.length})
      </summary>
      <p className="neo-muted neo-text-sm">
        Same docHash registered twice — on-chain <code>DuplicateAttempted</code> events from
        InvoiceRegistry.
      </p>
      <table className="neo-table">
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Attempted by</th>
            <th>Existing originator</th>
          </tr>
        </thead>
        <tbody>
          {duplicates.map((d) => (
            <tr key={d.id}>
              <td>
                <code title={d.invoiceId}>{shortHash(d.invoiceId as Hex)}</code>
              </td>
              <td>
                <code title={d.wouldBeOriginator}>{shortHash(d.wouldBeOriginator as Hex)}</code>
              </td>
              <td>
                <code title={d.existingOriginator}>{shortHash(d.existingOriginator as Hex)}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
