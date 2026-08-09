import { NextRequest, NextResponse } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { packAnchorStatuses, readOnChainAnchors } from '@/lib/audit-anchor'
import { addresses, explorerUrl } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const blocked = guardRateLimit(request, 'audit/anchor', { limit: 20, windowMs: 60_000 })
  if (blocked) return blocked

  try {
    const [anchors, packs] = await Promise.all([readOnChainAnchors(), packAnchorStatuses()])
    return NextResponse.json({
      contract: addresses.auditAnchor,
      explorer: `${explorerUrl}/address/${addresses.auditAnchor}`,
      anchors,
      packs,
      note: 'Only packHash is stored on-chain — IVMS101 PII stays in off-chain audit packs.',
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to read AuditAnchor' },
      { status: 502 },
    )
  }
}
