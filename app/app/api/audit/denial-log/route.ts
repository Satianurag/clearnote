import { NextRequest, NextResponse } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { aggregatePackDenialLogs } from '@/lib/audit-pack'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const blocked = guardRateLimit(request, 'audit/denial-log', { limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const entries = aggregatePackDenialLogs()
  return NextResponse.json({
    entries,
    source: 'seed/audit-packs/*.json',
    note:
      entries.length === 0
        ? 'No archived denials in on-disk packs — live matrix denials are under /api/compliance/denials'
        : undefined,
  })
}
