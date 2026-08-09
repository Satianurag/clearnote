import { NextRequest, NextResponse } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { runComplianceMatrixInspect } from '@/lib/compliance-inspect'
import { addresses, demoWallets } from '@/lib/config'
import { DEFAULT_INSPECT_UNITS } from '@/lib/inspect'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const blocked = guardRateLimit(request, 'compliance/denials', { limit: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const rows = await runComplianceMatrixInspect()
  const denials = rows
    .filter((r) => !r.ok && r.code !== 'error')
    .map((r) => ({
      scenario: r.wallet,
      from: demoWallets.b,
      to: r.to,
      amount: DEFAULT_INSPECT_UNITS.toString(),
      ok: false,
      selector: r.code,
      reason: r.reason,
      enforcedBy: r.enforcedBy,
      layer: r.layer,
    }))

  return NextResponse.json({
    capturedAt: new Date().toISOString(),
    token: addresses.clinv01,
    policy: addresses.clearNotePolicy,
    denials,
    passes: rows.filter((r) => r.ok).length,
    errors: rows.filter((r) => r.code === 'error').map((r) => ({ scenario: r.wallet, reason: r.reason })),
  })
}
