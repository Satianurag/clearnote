import { keccak256, stringToBytes } from 'viem'
import { canonicalize } from './canonicalize'

export function docHashFromXml(xml: string): `0x${string}` {
  const { bytes } = canonicalize(xml)
  return keccak256(bytes)
}

export function pintProfileHash(profileId: string, customizationId: string): `0x${string}` {
  return keccak256(stringToBytes(`${profileId}|${customizationId}`))
}
