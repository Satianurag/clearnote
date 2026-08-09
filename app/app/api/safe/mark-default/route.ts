import { NextRequest } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { guardApiPersona } from '@/lib/api-persona'
import { addresses } from '@/lib/config'
import { clearNoteControllerAbi } from '@/lib/contracts'
import { handleSafeInvoiceRoute, markDefaultCalldata } from '@/lib/safe-invoice-route'
import { verifyMarkDefaultSiwe } from '@/lib/siwe'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, 'safe/mark-default', { limit: 10, windowMs: 60_000 })
  if (blocked) return blocked

  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['exporter'] })
  if (personaBlocked) return personaBlocked

  return handleSafeInvoiceRoute(request, {
    rateLimitKey: 'safe-mark-default',
    verifySiwe: verifyMarkDefaultSiwe,
    requiredStatus: 3,
    requiredStatusLabel: 'Financed',
    encodeCalldata: markDefaultCalldata,
    simulate: async ({ client, invoiceId }) => {
      await client.simulateContract({
        address: addresses.controller,
        abi: clearNoteControllerAbi,
        functionName: 'markDefault',
        args: [invoiceId],
        account: addresses.safe,
      })
    },
  })
}
