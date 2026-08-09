import { NextRequest, NextResponse } from 'next/server'
import { queryIndexer, queryIndexerInvoices, queryIndexerOffers } from '@/lib/indexer'

export const dynamic = 'force-dynamic'

const ALLOWED_OPS = new Set(['transfers', 'invoices', 'offers'])

export async function GET(request: NextRequest) {
  const op = request.nextUrl.searchParams.get('op') ?? 'transfers'
  if (!ALLOWED_OPS.has(op)) {
    return NextResponse.json({ error: 'unknown operation' }, { status: 400 })
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '25')
  const capped = Math.min(Math.max(limit, 1), 100)

  if (op === 'transfers') {
    const result = await queryIndexer(capped)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 503 })
    return NextResponse.json({
      transfers: result.transfers,
      total: result.total,
      metadata: result.metadata,
    })
  }

  if (op === 'invoices') {
    const originator = request.nextUrl.searchParams.get('originator')?.trim() || undefined
    const result = await queryIndexerInvoices(capped, originator)
    if ('error' in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 503 })
    }
    return NextResponse.json(result)
  }

  const result = await queryIndexerOffers(capped)
  if ('error' in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }
  return NextResponse.json(result)
}
