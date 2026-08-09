import { type BaseError } from 'viem'
import { REASON_CODES, reasonForSelector } from '@/lib/reasonCodes'

const SELECTOR_RE = /0x[a-fA-F0-9]{8}/g

const HINTS: Record<string, string> = {
  '0xa6725971': 'Generate an A-Pass for the recipient before transferring.',
  '0x6294ca98': 'Wait for the transfer lockup period to expire.',
  '0x1513ddcb': 'Reduce the transfer amount or sell notes first.',
  '0x80279111': 'This address is on the sanctions list — transfer cannot proceed.',
  '0x322fde89': 'Wallet is frozen or A-Pass was revoked.',
}

export type DecodedTxError = {
  message: string
  selector?: string
  hint?: string
}

export function decodeTxError(error: Error | null | undefined): DecodedTxError {
  if (!error) return { message: 'Transaction failed' }

  const e = error as BaseError & {
    shortMessage?: string
    cause?: { shortMessage?: string; message?: string }
  }
  const raw = e.shortMessage ?? e.cause?.shortMessage ?? e.message ?? 'Transaction failed'
  const matches = raw.match(SELECTOR_RE)
  const selector = matches?.[0]?.toLowerCase()

  if (selector) {
    const label = reasonForSelector(selector) ?? REASON_CODES[selector]
    if (label) {
      return {
        message: label,
        selector,
        hint: HINTS[selector],
      }
    }
  }

  return { message: raw, selector }
}

export function formatTxError(error: Error | null | undefined): string {
  const decoded = decodeTxError(error)
  if (decoded.hint) return `${decoded.message} — ${decoded.hint}`
  return decoded.message
}
