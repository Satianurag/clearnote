import { NextResponse } from 'next/server'
import { listAuditPackInvoiceIds, listAuditPackMeta } from '@/lib/audit-pack'

export const dynamic = 'force-dynamic'

export async function GET() {
  const meta = listAuditPackMeta()
  const packs = meta.map((m) => m.id)
  const invoiceIds = listAuditPackInvoiceIds()
  return NextResponse.json({ packs, meta, invoiceIds })
}
