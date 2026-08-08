import { execFileSync } from 'node:child_process'

export interface Ivms101Party {
  naturalPerson?: { name: { primaryIdentifier: string } }
  legalPerson?: { name: string }
  accountNumber: string[]
  nationalIdentification?: { nationalIdentifier: string; nationalIdentifierType: string }
}

export interface Ivms101Payload {
  originator: Ivms101Party
  beneficiary: Ivms101Party
  originatingVASP: { legalPerson: { name: string } }
  beneficiaryVASP: { legalPerson: { name: string } }
}

export const THRESHOLD_USD = 1000
export const THRESHOLD_SGD = 1500

export function generateIvms101(opts: {
  originatorName: string
  beneficiaryName: string
  originatorAccount: string
  beneficiaryAccount: string
  amountUsd: number
}): { payload: Ivms101Payload; travelRuleRequired: boolean } {
  const travelRuleRequired = opts.amountUsd >= THRESHOLD_USD
  const payload: Ivms101Payload = {
    originator: {
      naturalPerson: { name: { primaryIdentifier: opts.originatorName } },
      accountNumber: [opts.originatorAccount],
      nationalIdentification: { nationalIdentifier: 'P9999999', nationalIdentifierType: 'PASSPORT' },
    },
    beneficiary: {
      naturalPerson: { name: { primaryIdentifier: opts.beneficiaryName } },
      accountNumber: [opts.beneficiaryAccount],
    },
    originatingVASP: { legalPerson: { name: 'ClearNote Issuer' } },
    beneficiaryVASP: { legalPerson: { name: 'ClearNote Investor' } },
  }
  return { payload, travelRuleRequired }
}

export function ivms101Hash(payload: Ivms101Payload): string {
  const json = JSON.stringify(payload)
  return execFileSync('cast', ['keccak', json], { encoding: 'utf8' }).trim()
}
