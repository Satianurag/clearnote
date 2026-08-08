import { NextResponse } from 'next/server'
import { getCleanverseConfig } from '@/lib/cleanverse'
import { queryIndexer } from '@/lib/indexer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const indexer = await queryIndexer(1)
  const cleanverse = getCleanverseConfig()

  const healthy = !indexer.error && Boolean(cleanverse)

  return NextResponse.json({
    status: healthy ? 'ok' : 'degraded',
    services: {
      indexer: indexer.error ? { ok: false, error: indexer.error } : { ok: true },
      cleanverse: cleanverse ? { ok: true } : { ok: false, error: 'missing credentials' },
    },
    timestamp: new Date().toISOString(),
  })
}
