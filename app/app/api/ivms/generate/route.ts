import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { guardRateLimit } from '@/lib/api-guard'
import { guardApiPersona } from '@/lib/api-persona'
import { generateIvms101, ivms101Hash, THRESHOLD_SGD, THRESHOLD_USD } from '@/lib/ivms'

export const dynamic = 'force-dynamic'

type Body = {
  originatorName?: string
  beneficiaryName?: string
  originatorAccount?: string
  beneficiaryAccount?: string
  amount?: number
  amountUsd?: number
  currency?: 'USD' | 'SGD'
}

/** Local IVMS101 generator — replaces broken Cleanverse download_travel_rule (WO-13). */
export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, 'ivms/generate', { limit: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['exporter', 'compliance'] })
  if (personaBlocked) return personaBlocked

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const originatorName = body.originatorName?.trim()
  const beneficiaryName = body.beneficiaryName?.trim()
  const originatorAccount = body.originatorAccount?.trim()
  const beneficiaryAccount = body.beneficiaryAccount?.trim()
  const amount = body.amount ?? body.amountUsd
  const currency = body.currency ?? 'USD'

  if (!originatorName || !beneficiaryName) {
    return NextResponse.json({ error: 'originatorName and beneficiaryName are required' }, { status: 400 })
  }
  if (!originatorAccount || !beneficiaryAccount) {
    return NextResponse.json({ error: 'originatorAccount and beneficiaryAccount are required' }, { status: 400 })
  }
  if (!isAddress(originatorAccount) || !isAddress(beneficiaryAccount)) {
    return NextResponse.json({ error: 'originatorAccount and beneficiaryAccount must be valid 0x addresses' }, { status: 400 })
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
    return NextResponse.json({ error: 'amount (or amountUsd) must be a non-negative number' }, { status: 400 })
  }

  const { payload, travelRuleRequired } = generateIvms101({
    originatorName,
    beneficiaryName,
    originatorAccount,
    beneficiaryAccount,
    amount,
    currency,
  })

  const hash = await ivms101Hash(payload)

  return NextResponse.json({
    payload,
    ivmsHash: hash,
    travelRuleRequired,
    thresholds: { usd: THRESHOLD_USD, sgd: THRESHOLD_SGD },
    privacy:
      'Only ivmsHash belongs on-chain (AuditAnchor). Full IVMS101 JSON is off-chain in audit packs.',
  })
}
