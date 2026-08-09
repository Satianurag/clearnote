/** Shared display formatting — en-SG locale, Asia/Singapore context. */
export const DISPLAY_LOCALE = 'en-SG'

export function formatTokenAmount(
  value: bigint,
  decimals = 18,
  maximumFractionDigits = 4,
): string {
  const base = BigInt(10) ** BigInt(decimals)
  const whole = value / base
  const frac = value % base
  if (frac === BigInt(0)) {
    return whole.toLocaleString(DISPLAY_LOCALE)
  }
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '')
  const trimmed = fracStr.slice(0, maximumFractionDigits).replace(/0+$/, '')
  if (!trimmed) return whole.toLocaleString(DISPLAY_LOCALE)
  return `${whole.toLocaleString(DISPLAY_LOCALE)}.${trimmed}`
}

export function formatUnixDate(unix: bigint | number): string {
  const ms = Number(unix) * 1000
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleDateString(DISPLAY_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Singapore',
  })
}

export function formatUnixDateTime(unix: bigint | number): string {
  const ms = Number(unix) * 1000
  if (!Number.isFinite(ms)) return '—'
  return new Date(ms).toLocaleString(DISPLAY_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  })
}

/** Whole major currency units as stored on InvoiceRegistry (e.g. 100000 SGD). */
export function formatCurrencyMajor(value: bigint, currency: string): string {
  return `${value.toLocaleString(DISPLAY_LOCALE)} ${currency.trim() || '—'}`
}

export function formatIsoTimestamp(iso: string): string {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return iso
  return new Date(ms).toLocaleString(DISPLAY_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Singapore',
  })
}
