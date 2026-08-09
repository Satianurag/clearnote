import { NextRequest, NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { guardRateLimit } from '@/lib/api-guard'
import { INVOICE_STATUS, type InvoiceStatusCode } from '@/lib/invoice-acceptance'
import { queryIndexerInvoices } from '@/lib/indexer'
import { readRegistryInvoice } from '@/lib/registry'

export const dynamic = 'force-dynamic'

export type PendingAction = {
  type: 'obligor_accept' | 'finance' | 'await_obligor' | 'settle' | 'trade_dvp'
  invoiceId: string
  status: number
  statusLabel: string
  href: string
  label: string
}

export async function GET(request: NextRequest) {
  const blocked = guardRateLimit(request, 'dashboard/pending', { limit: 40, windowMs: 60_000 })
  if (blocked) return blocked

  const address = request.nextUrl.searchParams.get('address')?.trim()
  if (!address || !isAddress(address)) {
    return NextResponse.json({ error: 'valid address required' }, { status: 400 })
  }

  const wallet = getAddress(address).toLowerCase()

  const [asOriginator, asObligor] = await Promise.all([
    queryIndexerInvoices(50, wallet),
    queryIndexerInvoices(50, undefined, wallet),
  ])

  const invoiceIds = new Set<string>()
  for (const inv of asOriginator.invoices ?? []) invoiceIds.add(inv.invoiceId.toLowerCase())
  for (const inv of asObligor.invoices ?? []) invoiceIds.add(inv.invoiceId.toLowerCase())

  const actions: PendingAction[] = []
  let awaitObligor = 0
  let canFinance = 0
  let canSettle = 0
  let obligorAccept = 0

  for (const invoiceId of invoiceIds) {
    const inv = await readRegistryInvoice(invoiceId as `0x${string}`)
    if (!inv) continue

    const status = Number(inv.status) as InvoiceStatusCode
    const statusLabel = INVOICE_STATUS[status] ?? `Unknown (${status})`
    const originatorMatch = inv.originator.toLowerCase() === wallet
    const obligorMatch = inv.obligor.toLowerCase() === wallet

    if (originatorMatch && status === 1) {
      awaitObligor++
      actions.push({
        type: 'await_obligor',
        invoiceId,
        status,
        statusLabel,
        href: `/obligor?invoice=${invoiceId}`,
        label: 'Share obligor accept link',
      })
    }

    if (originatorMatch && status === 2) {
      canFinance++
      actions.push({
        type: 'finance',
        invoiceId,
        status,
        statusLabel,
        href: '/exporter?tab=originator',
        label: 'Finance via Safe (issueNote)',
      })
    }

    if (originatorMatch && status === 3) {
      canSettle++
      actions.push({
        type: 'settle',
        invoiceId,
        status,
        statusLabel,
        href: '/exporter?tab=originator',
        label: 'Mark settled (obligor repaid)',
      })
    }

    if (obligorMatch && status === 1) {
      obligorAccept++
      actions.push({
        type: 'obligor_accept',
        invoiceId,
        status,
        statusLabel,
        href: `/obligor?invoice=${invoiceId}`,
        label: 'Sign EIP-712 acceptance',
      })
    }

    if (status === 3 && obligorMatch) {
      actions.push({
        type: 'trade_dvp',
        invoiceId,
        status,
        statusLabel,
        href: '/investor',
        label: 'Financed — trade CLINV01 on DvP',
      })
    }
  }

  return NextResponse.json({
    actions: actions.slice(0, 12),
    summary: { awaitObligor, canFinance, canSettle, obligorAccept, total: actions.length },
    indexerErrors: [asOriginator.error, asObligor.error].filter(Boolean),
  })
}
