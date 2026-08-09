'use client'

import { useEffect, useState } from 'react'

/** Invoice pack IDs (INV-001) and invoiceId hashes with on-disk audit packs */
export function useAuditPackIds(): {
  packs: string[]
  invoiceIds: Set<string>
  loading: boolean
} {
  const [packs, setPacks] = useState<string[]>([])
  const [invoiceIds, setInvoiceIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/audit/pack/list')
      .then((r) => r.json())
      .then((json: { packs?: string[]; invoiceIds?: string[] }) => {
        setPacks(json.packs ?? [])
        setInvoiceIds(new Set((json.invoiceIds ?? []).map((id) => id.toLowerCase())))
      })
      .catch(() => {
        setPacks([])
        setInvoiceIds(new Set())
      })
      .finally(() => setLoading(false))
  }, [])

  return { packs, invoiceIds, loading }
}
