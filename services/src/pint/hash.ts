import { createHash } from 'node:crypto'
import { canonicalize } from './canonicalize.js'

export function docHashFromXml(xml: string): string {
  const { bytes } = canonicalize(xml)
  return '0x' + createHash('keccak256').update(bytes).digest('hex')
}

export function pintProfileHash(profileId: string, customizationId: string): string {
  const packed = profileId + '|' + customizationId
  return '0x' + createHash('keccak256').update(packed, 'utf8').digest('hex')
}
