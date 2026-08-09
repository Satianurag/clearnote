import { NextRequest } from 'next/server'
import { guardRateLimit } from '@/lib/api-guard'
import { addresses } from '@/lib/config'
import { clearNoteControllerAbi } from '@/lib/contracts'
import { handleSafeInvoiceRoute, settleCalldata } from '@/lib/safe-invoice-route'
import { verifySettleSiwe } from '@/lib/siwe'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, 'safe/settle', { limit: 20, windowMs: 60_000 })
  if (blocked) return blocked

  return handleSafeInvoiceRoute(request, {
    rateLimitKey: 'safe-settle',
    verifySiwe: verifySettleSiwe,
    requiredStatus: 3,
    requiredStatusLabel: 'Financed',
    encodeCalldata: settleCalldata,
    simulate: async ({ client, invoiceId }) => {
      await client.simulateContract({
        address: addresses.controller,
        abi: clearNoteControllerAbi,
        functionName: 'settle',
        args: [invoiceId, addresses.clinv01],
        account: addresses.safe,
      })
    },
  })
}
