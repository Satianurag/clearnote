import { NextRequest, NextResponse } from 'next/server'
import { type Hex } from 'viem'
import { readRegistryInvoice } from '@/lib/registry'
import { INVOICE_STATUS, type InvoiceStatusCode } from '@/lib/invoice-acceptance'

export const dynamic = 'force-dynamic'

const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/

export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get('invoiceId')?.trim()
  if (!invoiceId || !BYTES32_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'valid invoiceId (bytes32) required' }, { status: 400 })
  }

  const inv = await readRegistryInvoice(invoiceId as Hex)
  if (!inv) {
    return NextResponse.json({ error: 'invoice not found on registry' }, { status: 404 })
  }

  const status = Number(inv.status) as InvoiceStatusCode
  return NextResponse.json({
    invoiceId: invoiceId.toLowerCase(),
    originator: inv.originator,
    obligor: inv.obligor,
    faceValue: inv.faceValue.toString(),
    dueDate: inv.dueDate.toString(),
    registeredAt: inv.registeredAt.toString(),
    status,
    statusLabel: INVOICE_STATUS[status] ?? `Unknown (${status})`,
  })
}

export async function POST(request: NextRequest) {
  let body: { invoiceIds?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const ids = (body.invoiceIds ?? []).filter((id) => BYTES32_RE.test(id)) as Hex[]
  if (ids.length === 0) {
    return NextResponse.json({ error: 'invoiceIds array required' }, { status: 400 })
  }
  if (ids.length > 20) {
    return NextResponse.json({ error: 'max 20 invoiceIds per request' }, { status: 400 })
  }

  const invoices = await Promise.all(
    ids.map(async (invoiceId) => {
      const inv = await readRegistryInvoice(invoiceId)
      if (!inv) return null
      const status = Number(inv.status) as InvoiceStatusCode
      return {
        invoiceId: invoiceId.toLowerCase(),
        originator: inv.originator,
        obligor: inv.obligor,
        faceValue: inv.faceValue.toString(),
        status,
        statusLabel: INVOICE_STATUS[status] ?? `Unknown (${status})`,
      }
    }),
  )

  return NextResponse.json({ invoices: invoices.filter(Boolean) })
}
