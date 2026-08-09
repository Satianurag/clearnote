import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/** Serve the marketing landing page at `/` without the app shell layout. */
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/landing.html', request.url))
  }
}

export const config = {
  matcher: ['/'],
}
