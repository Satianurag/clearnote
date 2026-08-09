export type ValidationResult = {
  ok: boolean
  errors: string[]
  method: 'structural'
}

export function validatePintXmlString(xml: string): ValidationResult {
  const errors: string[] = []
  if (!xml.includes('Invoice')) errors.push('missing Invoice root')
  if (!xml.includes('cbc:ID')) errors.push('missing cbc:ID')
  if (!xml.includes('cbc:ProfileID')) errors.push('missing cbc:ProfileID')
  if (!xml.includes('cbc:CustomizationID')) errors.push('missing cbc:CustomizationID')
  if (!xml.includes('cbc:PayableAmount')) errors.push('missing cbc:PayableAmount')
  return { ok: errors.length === 0, errors, method: 'structural' }
}
