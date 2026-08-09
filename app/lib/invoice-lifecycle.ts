import type { Hex } from 'viem'
import { INVOICE_STATUS, type InvoiceStatusCode } from '@/lib/invoice-acceptance'

export function invoiceStatusLabel(status: number): string {
  return INVOICE_STATUS[status as InvoiceStatusCode] ?? `Unknown (${status})`
}

export function settlementSummary(status: number): string {
  switch (status) {
    case 3:
      return 'Note issued — awaiting obligor repayment at due date. Secondary trading via DvP is available.'
    case 4:
      return 'Obligor repaid — invoice marked settled on InvoiceRegistry. Note backing released.'
    case 5:
      return 'Obligor defaulted — originator / investor recovery per program terms.'
    case 6:
      return 'Dispute raised — lifecycle paused pending evidence resolution.'
    default:
      return 'Pre-settlement — complete obligor acceptance and finance first.'
  }
}

export type PositionRow = {
  invoiceId: Hex
  units: string
  source: 'issued' | 'dvp'
  cashPaid?: string
  offerId?: string
}

export const LIFECYCLE_STEP_LABELS: Record<number, string> = {
  1: 'Registered',
  2: 'Obligor accepted',
  3: 'Financed',
  4: 'Settled',
}

export const LIFECYCLE_STEPS = [1, 2, 3, 4] as const
