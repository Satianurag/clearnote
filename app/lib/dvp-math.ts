import { parseUnits } from 'viem'

const NOTE_UNIT = parseUnits('1', 18)

/** Matches DvPEscrow.fill: cashAmt = (units * pricePerUnit) / 1e18 */
export function cashForUnits(units: bigint, pricePerUnit: bigint): bigint {
  return (units * pricePerUnit) / NOTE_UNIT
}

/** Approve at least the on-chain floor; never over-estimate vs contract fill. */
export function cashAllowanceForFill(units: bigint, pricePerUnit: bigint): bigint {
  return cashForUnits(units, pricePerUnit)
}
