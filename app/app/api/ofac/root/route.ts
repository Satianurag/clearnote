import { NextRequest, NextResponse } from 'next/server'
import { guardApiPersona } from '@/lib/api-persona'
import { ofacRootMeta } from '@/lib/ofac'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['compliance'] })
  if (personaBlocked) return personaBlocked

  const meta = ofacRootMeta()
  if (!meta) {
    return NextResponse.json({ error: 'seed/ofac/ofac-root.json not found — run pnpm ofac:build' }, { status: 404 })
  }
  return NextResponse.json(meta)
}
