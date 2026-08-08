import { NextRequest, NextResponse } from 'next/server'
import { cvRequest, getCleanverseConfig } from '@/lib/cleanverse'

export const dynamic = 'force-dynamic'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export async function POST(request: NextRequest) {
  const config = getCleanverseConfig()
  if (!config) {
    return NextResponse.json({ error: 'Cleanverse not configured' }, { status: 503 })
  }

  let body: { address?: string; chain?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const address = body.address?.trim()
  const chain = (body.chain?.trim() || 'monad').toLowerCase()

  if (!address || !ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: 'valid address required' }, { status: 400 })
  }

  const result = await cvRequest(config.base, config.apiId, config.apiKey, '/query_apass', {
    chain,
    address,
  })

  return NextResponse.json({
    ok: result.ok,
    code: result.code,
    message: result.message,
    data: result.data,
  })
}
