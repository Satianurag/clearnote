import { NextRequest, NextResponse } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { guardApiPersona } from '@/lib/api-persona'
import { getCleanverseConfig, cvRequest } from '@/lib/cleanverse'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, 'cleanverse/ramp/quote', { limit: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['investor'] })
  if (personaBlocked) return personaBlocked

  const config = getCleanverseConfig()
  if (!config) {
    return NextResponse.json({ error: 'Cleanverse not configured' }, { status: 503 })
  }

  let body: { fiatAmount?: number; network?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const fiatAmount = body.fiatAmount ?? 500
  const network = body.network ?? 'monad'

  const result = await cvRequest(config.base, config.apiId, config.apiKey, '/query_ramp_quote', {
    fiatCurrency: 'USD',
    cryptoCurrency: 'USDC',
    isBuyOrSell: 'BUY',
    network,
    paymentMethod: 'credit_debit_card',
    fiatAmount,
  })

  return NextResponse.json({
    ok: result.ok,
    code: result.code,
    message: result.message,
    data: result.data,
  })
}
