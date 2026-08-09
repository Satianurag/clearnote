'use client'

import { LandingHeader } from '@/components/LandingHeader'
import { Nav } from '@/components/Nav'

export function ProductShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-shell">
      <LandingHeader variant="product" />
      <div className="product-shell__body">
        <div className="product-shell__nav">
          <Nav />
        </div>
        <main className="product-main">{children}</main>
      </div>
    </div>
  )
}
