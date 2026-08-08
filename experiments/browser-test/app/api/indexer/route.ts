import { NextRequest, NextResponse } from 'next/server'
import { queryIndexer } from '@/lib/indexer'

export const dynamic = 'force-dynamic'

const ALLOWED_OPS = new Set(['transfers'])

export async function GET(request: NextRequest) {
  const op = request.nextUrl.searchParams.get('op') ?? 'transfers'
  if (!ALLOWED_OPS.has(op)) {
    return NextResponse.json({ error: 'unknown operation' }, { status: 400 })
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '25')
  const result = await queryIndexer(Math.min(Math.max(limit, 1), 100))

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 503 })
  }

  return NextResponse.json({
    transfers: result.transfers,
    total: result.total,
    metadata: result.metadata,
  })
}
