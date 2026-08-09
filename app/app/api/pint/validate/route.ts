import { NextResponse } from 'next/server'
import { docHashFromXml, pintProfileHash } from '@/lib/pint/hash'
import { canonicalize } from '@/lib/pint/canonicalize'
import { parseInvoiceFields } from '@/lib/pint/parse'
import { validatePintXmlString } from '@/lib/pint/validate'

export async function POST(req: Request) {
  let body: { xml?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const xml = body.xml?.trim()
  if (!xml) {
    return NextResponse.json({ error: 'xml is required' }, { status: 400 })
  }

  const validation = validatePintXmlString(xml)
  const { excluded } = canonicalize(xml)
  const docHash = docHashFromXml(xml)
  const parsed = parseInvoiceFields(xml)

  const pintProfileHashVal =
    parsed.profileId && parsed.customizationId
      ? pintProfileHash(parsed.profileId, parsed.customizationId)
      : null

  return NextResponse.json({
    docHash,
    pintProfileHash: pintProfileHashVal,
    validation,
    excluded,
    fields: {
      invoiceId: parsed.invoiceId,
      profileId: parsed.profileId,
      customizationId: parsed.customizationId,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      currency: parsed.currency,
      obligorName: parsed.obligorName,
      faceValue: parsed.faceValue != null ? parsed.faceValue.toString() : null,
    },
  })
}
