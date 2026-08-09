import { NextRequest, NextResponse } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { guardApiPersona } from '@/lib/api-persona'
import { getCleanverseConfig, cvRequest } from '@/lib/cleanverse'

export const dynamic = 'force-dynamic'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, 'cleanverse/validator', { limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['investor'] })
  if (personaBlocked) return personaBlocked

  const config = getCleanverseConfig()
  if (!config) {
    return NextResponse.json({ error: 'Cleanverse not configured' }, { status: 503 })
  }

  let body: { chain?: string; contract_address?: string; user_address?: string; action?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const chain = (body.chain?.trim() || 'monad').toLowerCase()
  const contractAddress = body.contract_address?.trim()
  const userAddress = body.user_address?.trim()
  const action = body.action ?? 'verify'

  if (!contractAddress || !ADDRESS_RE.test(contractAddress)) {
    return NextResponse.json({ error: 'valid contract_address required' }, { status: 400 })
  }

  if (action === 'is_register') {
    const result = await cvRequest(config.base, config.apiId, config.apiKey, '/validator/is_register', {
      chain,
      contract_address: contractAddress,
    })
    return NextResponse.json({ ok: result.ok, code: result.code, message: result.message, data: result.data })
  }

  if (!userAddress || !ADDRESS_RE.test(userAddress)) {
    return NextResponse.json({ error: 'valid user_address required for verify' }, { status: 400 })
  }

  const result = await cvRequest(config.base, config.apiId, config.apiKey, '/validator/verify', {
    chain,
    contract_address: contractAddress,
    user_address: userAddress,
  })

  return NextResponse.json({ ok: result.ok, code: result.code, message: result.message, data: result.data })
}
