import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, getAddress, http, isAddress, type Hex } from 'viem'
import { guardRateLimit } from '@/lib/api-guard'
import { addresses, rpcUrl } from '@/lib/config'
import { invoiceRegistryAbi } from '@/lib/contracts'
import { INVOICE_STATUS, decodeBytes3Currency, type InvoiceStatusCode } from '@/lib/invoice-acceptance'
import { queryIndexerPositions } from '@/lib/indexer'
import { monadTestnet } from '@/wagmi.config'

export const dynamic = 'force-dynamic'

const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })

export async function GET(request: NextRequest) {
  const blocked = guardRateLimit(request, 'investor/positions', { limit: 40, windowMs: 60_000 })
  if (blocked) return blocked

  const holder = request.nextUrl.searchParams.get('holder')?.trim()
  if (!holder || !isAddress(holder)) {
    return NextResponse.json({ error: 'valid holder address required' }, { status: 400 })
  }

  const holderAddr = getAddress(holder)
  const indexer = await queryIndexerPositions(holderAddr, 50)
  if (indexer.error) {
    return NextResponse.json({ positions: [], error: indexer.error }, { status: 503 })
  }

  const rawRows: Array<{
    invoiceId?: string
    units: string
    source: 'issued' | 'dvp'
    cashPaid?: string
    offerId?: string
    noteToken?: string
  }> = [
    ...indexer.issued.map((r) => ({ ...r, source: 'issued' as const })),
    ...indexer.fills,
  ]

  const byInvoice = new Map<string, (typeof rawRows)[0]>()

  for (const row of rawRows) {
    let invoiceId = row.invoiceId
    if (!invoiceId && row.noteToken) {
      try {
        invoiceId = await client.readContract({
          address: addresses.registry,
          abi: invoiceRegistryAbi,
          functionName: 'backingOf',
          args: [getAddress(row.noteToken as Hex)],
        })
        if (invoiceId === `0x${'0'.repeat(64)}`) invoiceId = undefined
      } catch {
        invoiceId = undefined
      }
    }
    if (!invoiceId) continue
    const key = invoiceId.toLowerCase()
    const existing = byInvoice.get(key)
    if (!existing || row.source === 'issued') {
      byInvoice.set(key, { ...row, invoiceId })
    }
  }

  const positions = await Promise.all(
    [...byInvoice.values()].map(async (row) => {
      const inv = await client.readContract({
        address: addresses.registry,
        abi: invoiceRegistryAbi,
        functionName: 'get',
        args: [row.invoiceId as Hex],
      })
      const status = Number(inv.status)
      return {
        invoiceId: row.invoiceId,
        units: row.units,
        source: row.source,
        cashPaid: row.cashPaid,
        offerId: row.offerId,
        status,
        statusLabel: INVOICE_STATUS[status as InvoiceStatusCode] ?? `Unknown (${status})`,
        faceValue: inv.faceValue.toString(),
        dueDate: inv.dueDate.toString(),
        currency: decodeBytes3Currency(inv.currency),
        obligor: inv.obligor,
      }
    }),
  )

  return NextResponse.json({ positions, holder: holderAddr })
}
