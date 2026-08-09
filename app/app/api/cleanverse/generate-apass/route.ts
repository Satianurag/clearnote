import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { cvRequest } from '@/lib/cleanverse'
import { getServerSecret } from '@/lib/server-keys'

export const dynamic = 'force-dynamic'

function getCleanverseConfig() {
  const base = getServerSecret('CLEANVERSE_API_BASE')
  const apiId = getServerSecret('CLEANVERSE_API_ID')
  const apiKey = getServerSecret('CLEANVERSE_API_KEY')
  if (!base || !apiId || !apiKey) return null
  return { base, apiId, apiKey }
}

export async function POST(request: NextRequest) {
  const config = getCleanverseConfig()
  if (!config) {
    return NextResponse.json({ error: 'Cleanverse not configured' }, { status: 503 })
  }

  let body: {
    address?: string
    chain?: string
    fullName?: string
    country?: string
    customerId?: string
    expirationTime?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const address = body.address?.trim()
  const chain = (body.chain?.trim() || 'monad').toLowerCase()

  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'valid wallet address required' }, { status: 400 })
  }

  const fullName = body.fullName?.trim() || 'ClearNote Demo User'
  const country = (body.country?.trim() || 'SG').toUpperCase().slice(0, 2)
  const customerId = body.customerId?.trim() || `clearnote-${getAddress(address).slice(2, 10)}`
  const expirationTime =
    body.expirationTime ?? Math.floor(Date.now() / 1000) + 365 * 86_400

  const payload = {
    chain,
    wallet: { address: getAddress(address), chain },
    customerId,
    expirationTime,
    tier: '50',
    identityDataList: [{ fullName, issuingCountryISO2: country }],
  }

  const result = await cvRequest(
    config.base,
    config.apiId,
    config.apiKey,
    '/generate_apass',
    payload,
    { encrypted: true },
  )

  return NextResponse.json({
    ok: result.ok,
    code: result.code,
    message: result.message,
    data: result.data,
    ...(result.ok
      ? {}
      : {
          error:
            (typeof result.message === 'string' && result.message) ||
            'generate_apass failed — wallet may already have an A-Pass',
        }),
  })
}
