import { parseUnits } from 'viem'

/** Default CLINV01 units for policy inspect() pre-flight (1 note). */
export const DEFAULT_INSPECT_UNITS = parseUnits('1', 18)
