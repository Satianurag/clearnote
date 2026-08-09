import { NextRequest, NextResponse } from 'next/server'
import { guardApiPersona } from '@/lib/api-persona'
import { listAuditPackInvoiceIds, listAuditPackMeta } from '@/lib/audit-pack'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['compliance'] })
  if (personaBlocked) return personaBlocked

  const meta = listAuditPackMeta()
  const packs = meta.map((m) => m.id)
  const invoiceIds = listAuditPackInvoiceIds()
  return NextResponse.json({ packs, meta, invoiceIds })
}
