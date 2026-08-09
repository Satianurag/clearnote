/** IVMS101 travel-rule payload builder (WO-13) — mirrors services/src/ivms/generator.ts */
export const THRESHOLD_USD = Number(process.env.IVMS_THRESHOLD_USD ?? '1000')
export const THRESHOLD_SGD = Number(process.env.IVMS_THRESHOLD_SGD ?? '1500')

export type Ivms101Party = {
  naturalPerson?: { name: { primaryIdentifier: string } }
  legalPerson?: { name: string }
  accountNumber: string[]
  nationalIdentification?: { nationalIdentifier: string; nationalIdentifierType: string }
}

export type Ivms101Payload = {
  originator: Ivms101Party
  beneficiary: Ivms101Party
  originatingVASP: { legalPerson: { name: string } }
  beneficiaryVASP: { legalPerson: { name: string } }
}

export function travelRuleRequired(amount: number, currency: 'USD' | 'SGD' = 'USD'): boolean {
  const threshold = currency === 'SGD' ? THRESHOLD_SGD : THRESHOLD_USD
  return amount >= threshold
}

export function generateIvms101(opts: {
  originatorName: string
  beneficiaryName: string
  originatorAccount: string
  beneficiaryAccount: string
  amount: number
  currency?: 'USD' | 'SGD'
}): { payload: Ivms101Payload; travelRuleRequired: boolean } {
  const currency = opts.currency ?? 'USD'
  const required = travelRuleRequired(opts.amount, currency)
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
  return { payload, travelRuleRequired: required }
}

/** keccak256 of canonical JSON — only this hash belongs on-chain (AuditAnchor). */
export async function ivms101Hash(payload: Ivms101Payload): Promise<`0x${string}`> {
  const { keccak256, toBytes } = await import('viem')
  return keccak256(toBytes(JSON.stringify(payload)))
}
