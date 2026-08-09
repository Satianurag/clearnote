import type { Address, Hex } from 'viem'
import { chainId } from '@/lib/config'
import { formatCurrencyMajor } from '@/lib/format'

/**
 * Deployed InvoiceRegistry EIP-712 domain (matches InvoiceRegistry.sol constructor).
 *
 * InvoiceAcceptance typed data on-chain:
 *   invoiceId, obligor, faceValue, dueDate, deadline
 *
 * Notion / draft specs may list extra fields (seller, nonce) — those are NOT in the
 * deployed contract on Monad testnet. UI and scripts must match this struct only.
 */
export const INVOICE_STATUS = {
  0: 'None',
  1: 'Registered',
  2: 'Obligor accepted',
  3: 'Financed',
  4: 'Settled',
  5: 'Defaulted',
  6: 'Disputed',
} as const

export type InvoiceStatusCode = keyof typeof INVOICE_STATUS

export const invoiceAcceptanceTypes = {
  InvoiceAcceptance: [
    { name: 'invoiceId', type: 'bytes32' },
    { name: 'obligor', type: 'address' },
    { name: 'faceValue', type: 'uint256' },
    { name: 'dueDate', type: 'uint64' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const

export function invoiceAcceptanceDomain(verifyingContract: Address) {
  return {
    name: 'ClearNote',
    version: '1',
    chainId,
    verifyingContract,
  } as const
}

/** Signature valid until — 7 days from now (on-chain deadline param). */
export function acceptanceDeadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400)
}

export function decodeBytes3Currency(raw: Hex | string): string {
  const hex = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!hex) return '—'
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return new TextDecoder().decode(bytes).replace(/\0/g, '').trim() || '—'
}

export function shortHash(hash: Hex): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`
}

export function shortAddress(addr: Address): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function isBytes32(value: string): value is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(value)
}

/** On-chain face values are whole currency major units (e.g. 100000 = SGD 100,000). */
export function parseFaceValueForChain(amountRaw: string | null): bigint | null {
  if (!amountRaw) return null
  const cleaned = amountRaw.replace(/,/g, '').trim()
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?$/)
  if (!match) return null
  const whole = BigInt(match[1])
  const frac = match[2] ?? ''
  if (!frac || /^0+$/.test(frac)) return whole
  // Chain stores major units only — round half-up from first fractional digit.
  const first = frac[0] ?? '0'
  return first >= '5' ? whole + BigInt(1) : whole
}

export function formatFaceValue(value: bigint | number, currency: string): string {
  const n = typeof value === 'bigint' ? value : BigInt(Math.trunc(value))
  return formatCurrencyMajor(n, currency)
}
