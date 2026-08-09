import { NextResponse } from 'next/server'
import { ofacRootMeta } from '@/lib/ofac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const meta = ofacRootMeta()
  if (!meta) {
    return NextResponse.json({ error: 'seed/ofac/ofac-root.json not found — run pnpm ofac:build' }, { status: 404 })
  }
  return NextResponse.json(meta)
}
