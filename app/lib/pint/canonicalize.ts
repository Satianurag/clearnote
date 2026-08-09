/** Strip cac:PayeeParty and volatile nodes; normalize whitespace for deterministic hash. */
export function canonicalize(xml: string): { bytes: Uint8Array; excluded: string[] } {
  const excluded: string[] = []
  let out = xml
  out = out.replace(/<!--[\s\S]*?-->/g, '')

  out = out.replace(/<cac:PayeeParty[\s>][\s\S]*?<\/cac:PayeeParty>/gi, () => {
    excluded.push('cac:PayeeParty')
    return ''
  })
  out = out.replace(/<cbc:UUID>[\s\S]*?<\/cbc:UUID>/gi, () => {
    excluded.push('cbc:UUID')
    return ''
  })
  out = out.replace(/<cbc:IssueTime>[\s\S]*?<\/cbc:IssueTime>/gi, () => {
    excluded.push('cbc:IssueTime')
    return ''
  })
  out = out.replace(/<cac:Signature[\s>][\s\S]*?<\/cac:Signature>/gi, () => {
    excluded.push('cac:Signature')
    return ''
  })

  out = out.replace(/\s+/g, ' ').trim()
  out = out.replace(/>\s+</g, '><')
  return { bytes: new TextEncoder().encode(out), excluded }
}
