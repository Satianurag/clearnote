export const THRESHOLD_USD = Number(process.env.IVMS_THRESHOLD_USD ?? '1000')
export const THRESHOLD_SGD = Number(process.env.IVMS_THRESHOLD_SGD ?? '1500')

export function travelRuleRequired(amount, currency = 'USD') {
  const threshold = currency === 'SGD' ? THRESHOLD_SGD : THRESHOLD_USD
  return amount >= threshold
}

export function generateIvms101(opts) {
  const currency = opts.currency ?? 'USD'
  const required = travelRuleRequired(opts.amount ?? opts.amountUsd ?? 0, currency)
  const payload = {
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
