/** Lightweight in-memory rate limiter for API routes (per key, sliding window). */

type Entry = { count: number; resetAt: number }

const buckets = new Map<string, Entry>()

export function rateLimit(
  key: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now()
  const entry = buckets.get(key)

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }

  if (entry.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) }
  }

  entry.count += 1
  return { ok: true }
}
