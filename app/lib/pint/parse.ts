import { parseFaceValueForChain } from '@/lib/invoice-acceptance'

/** Default trade receivable tenor when XML has no cbc:DueDate (ClearNote story: 90 days). */
export const DEFAULT_INVOICE_TENOR_DAYS = 90

export type ParsedInvoiceFields = {
  invoiceId: string | null
  profileId: string | null
  customizationId: string | null
  issueDate: string | null
  dueDate: string | null
  currency: string | null
  faceValue: bigint | null
  obligorName: string | null
}

function tagText(xml: string, localName: string): string | null {
  const re = new RegExp(`<cbc:${localName}[^>]*>([^<]*)</cbc:${localName}>`, 'i')
  const match = xml.match(re)
  return match?.[1]?.trim() ?? null
}

function partyName(xml: string, partyTag: string): string | null {
  const re = new RegExp(
    `<cac:${partyTag}[\\s>][\\s\\S]*?<cac:PartyName>\\s*<cbc:Name>([^<]*)</cbc:Name>`,
    'i',
  )
  const match = xml.match(re)
  return match?.[1]?.trim() ?? null
}

export function parseInvoiceFields(xml: string): ParsedInvoiceFields {
  const amountRaw = tagText(xml, 'PayableAmount')
  const faceValue = parseFaceValueForChain(amountRaw)

  const currencyFromAmount = xml.match(/<cbc:PayableAmount[^>]*currencyID="([^"]+)"/i)?.[1] ?? null

  return {
    invoiceId: tagText(xml, 'ID'),
    profileId: tagText(xml, 'ProfileID'),
    customizationId: tagText(xml, 'CustomizationID'),
    issueDate: tagText(xml, 'IssueDate'),
    dueDate: tagText(xml, 'DueDate'),
    currency: tagText(xml, 'DocumentCurrencyCode') ?? currencyFromAmount,
    faceValue,
    obligorName: partyName(xml, 'AccountingCustomerParty'),
  }
}

export function currencyToBytes3(code: string): `0x${string}` {
  const normalized = code.trim().toUpperCase().slice(0, 3)
  const bytes = new TextEncoder().encode(normalized.padEnd(3, '\0'))
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `0x${hex}` as `0x${string}`
}

export function dueDateToTimestamp(dueDate: string | null): number | null {
  if (!dueDate) return null
  const base = Date.parse(`${dueDate}T00:00:00Z`)
  if (!Number.isFinite(base)) return null
  return Math.floor(base / 1000)
}

export function issueDateToDueTimestamp(issueDate: string | null, days = DEFAULT_INVOICE_TENOR_DAYS): number {
  if (!issueDate) {
    return Math.floor(Date.now() / 1000) + days * 86_400
  }
  const base = Date.parse(`${issueDate}T00:00:00Z`)
  if (!Number.isFinite(base)) {
    return Math.floor(Date.now() / 1000) + days * 86_400
  }
  return Math.floor(base / 1000) + days * 86_400
}

/** Prefer explicit cbc:DueDate; fall back to issue date + default tenor. */
export function resolveDueTimestamp(
  issueDate: string | null,
  dueDate: string | null,
  days = DEFAULT_INVOICE_TENOR_DAYS,
): number {
  const fromDue = dueDateToTimestamp(dueDate)
  if (fromDue !== null) return fromDue
  return issueDateToDueTimestamp(issueDate, days)
}
