'use client'

import { LandingHeader } from '@/components/LandingHeader'
import { Nav } from '@/components/Nav'
import { PersonaGate } from '@/components/PersonaGate'

export function ProductShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="product-shell">
      <LandingHeader variant="product" />
      <div className="product-shell__body">
        <div className="product-shell__nav">
          <Nav />
        </div>
        <main className="product-main">
          <PersonaGate>{children}</PersonaGate>
        </main>
      </div>
    </div>
  )
}
