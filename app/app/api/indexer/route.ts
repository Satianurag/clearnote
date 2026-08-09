import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import {
  queryIndexer,
  queryIndexerCompliance,
  queryIndexerInvoices,
  queryIndexerOffers,
} from '@/lib/indexer'

export const dynamic = 'force-dynamic'

const ALLOWED_OPS = new Set(['transfers', 'invoices', 'offers', 'compliance'])
const TOKEN_LABELS = new Set(['CLNOTE02', 'CLLAT01', 'CLINV01'])

export async function GET(request: NextRequest) {
  const op = request.nextUrl.searchParams.get('op') ?? 'transfers'
  if (!ALLOWED_OPS.has(op)) {
    return NextResponse.json({ error: 'unknown operation' }, { status: 400 })
  }

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '25')
  const capped = Math.min(Math.max(limit, 1), 100)

  if (op === 'transfers') {
    const wallet = request.nextUrl.searchParams.get('wallet')?.trim()
    const token = request.nextUrl.searchParams.get('token')?.trim()
    if (wallet && !isAddress(wallet)) {
      return NextResponse.json({ error: 'invalid wallet address' }, { status: 400 })
    }
    if (token && !TOKEN_LABELS.has(token)) {
      return NextResponse.json(
        { error: 'token must be CLNOTE02, CLLAT01, or CLINV01' },
        { status: 400 },
      )
    }
    const result = await queryIndexer(capped, wallet, token)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 503 })
    return NextResponse.json({
      transfers: result.transfers,
      total: result.total,
      metadata: result.metadata,
      filter: { wallet: wallet ?? null, token: token ?? null },
    })
  }

  if (op === 'compliance') {
    const result = await queryIndexerCompliance(capped)
    if (result.error) return NextResponse.json({ error: result.error }, { status: 503 })
    return NextResponse.json({ events: result.events })
  }

  if (op === 'invoices') {
    const originator = request.nextUrl.searchParams.get('originator')?.trim() || undefined
    const obligor = request.nextUrl.searchParams.get('obligor')?.trim() || undefined
    const result = await queryIndexerInvoices(capped, originator, obligor)
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
