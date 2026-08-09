export type ParsedInvoiceFields = {
  invoiceId: string | null
  profileId: string | null
  customizationId: string | null
  issueDate: string | null
  currency: string | null
  faceValue: number | null
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
  let faceValue: number | null = null
  if (amountRaw) {
    const parsed = Number.parseFloat(amountRaw.replace(/,/g, ''))
    faceValue = Number.isFinite(parsed) ? Math.round(parsed) : null
  }

  const currencyFromAmount = xml.match(/<cbc:PayableAmount[^>]*currencyID="([^"]+)"/i)?.[1] ?? null

  return {
    invoiceId: tagText(xml, 'ID'),
    profileId: tagText(xml, 'ProfileID'),
    customizationId: tagText(xml, 'CustomizationID'),
    issueDate: tagText(xml, 'IssueDate'),
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

export function issueDateToDueTimestamp(issueDate: string | null, days = 30): number {
  if (!issueDate) {
    return Math.floor(Date.now() / 1000) + days * 86_400
  }
  const base = Date.parse(`${issueDate}T00:00:00Z`)
  if (!Number.isFinite(base)) {
    return Math.floor(Date.now() / 1000) + days * 86_400
  }
  return Math.floor(base / 1000) + days * 86_400
}
