import { NextRequest, NextResponse } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { guardApiPersona } from '@/lib/api-persona'
import { loadAuditPack, readAuditPackZip } from '@/lib/audit-pack'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const blocked = guardRateLimit(request, 'audit/pack', { limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['compliance'] })
  if (personaBlocked) return personaBlocked

  const id =
    request.nextUrl.searchParams.get('id')?.trim() ||
    request.nextUrl.searchParams.get('invoiceId')?.trim()
  const format = request.nextUrl.searchParams.get('format')?.trim().toLowerCase() ?? 'json'

  if (!id) {
    return NextResponse.json({ error: 'id or invoiceId query param required (e.g. INV-001)' }, { status: 400 })
  }

  const pack = loadAuditPack(id)
  if (!pack) {
    return NextResponse.json(
      {
        error: `audit pack not found for ${id} — only seeded packs under seed/audit-packs/ are served (run pnpm audit:pack)`,
      },
      { status: 404 },
    )
  }

  if (format === 'zip') {
    const zip = readAuditPackZip(id)
    if (!zip) {
      return NextResponse.json(
        {
          error: `ZIP not found for ${pack.invoiceId} — run pnpm audit:pack ${pack.invoiceId} from repo root`,
        },
        { status: 404 },
      )
    }
    const filename = `clearnote-audit-${pack.invoiceId}.zip`
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  const filename = `clearnote-audit-${pack.invoiceId}.json`
  return new NextResponse(JSON.stringify(pack, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
