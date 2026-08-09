import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

export function guardRateLimit(
  request: NextRequest,
  routeKey: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): NextResponse | null {
  const ip = clientIp(request)
  const result = rateLimit(`api:${routeKey}:${ip}`, { limit, windowMs })
  if (!result.ok) {
    return NextResponse.json(
      { error: `rate limit exceeded — retry in ${result.retryAfterSec}s` },
      { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } },
    )
  }
  return null
}
