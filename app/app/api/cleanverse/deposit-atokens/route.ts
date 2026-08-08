import { NextResponse } from 'next/server'
import { getCleanverseConfig, cvRequest } from '@/lib/cleanverse'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getCleanverseConfig()
  if (!config) {
    return NextResponse.json({ error: 'Cleanverse not configured' }, { status: 503 })
  }

  const result = await cvRequest(config.base, config.apiId, config.apiKey, '/query_deposit_atoken_list', {
    chain: 'monad',
  })

  return NextResponse.json({
    ok: result.ok,
    code: result.code,
    message: result.message,
    data: result.data,
  })
}
