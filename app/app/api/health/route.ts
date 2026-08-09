import { NextResponse } from 'next/server'
import { getCleanverseConfig } from '@/lib/cleanverse'
import { checkOfacRootAlignment } from '@/lib/ofac-onchain'
import { queryIndexer } from '@/lib/indexer'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [indexer, ofac] = await Promise.all([queryIndexer(1), checkOfacRootAlignment()])
  const cleanverse = getCleanverseConfig()

  const indexerOk = !indexer.error
  const cleanverseOk = Boolean(cleanverse)
  const ofacOk = ofac.ok

  const healthy = indexerOk && cleanverseOk && ofacOk

  return NextResponse.json({
    status: healthy ? 'ok' : 'degraded',
    services: {
      indexer: indexer.error ? { ok: false, error: indexer.error } : { ok: true },
      cleanverse: cleanverse ? { ok: true } : { ok: false, error: 'missing credentials' },
      ofac: ofac.error
        ? { ok: false, error: ofac.error, seedRoot: ofac.seedRoot, onChainRoot: ofac.onChainRoot }
        : {
            ok: ofac.rootMatches,
            rootMatches: ofac.rootMatches,
            sourceDate: ofac.sourceDate,
            seedRoot: ofac.seedRoot,
            onChainRoot: ofac.onChainRoot,
          },
    },
    timestamp: new Date().toISOString(),
  })
}
