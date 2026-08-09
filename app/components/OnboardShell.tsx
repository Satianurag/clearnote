import type { ReactNode } from 'react'
import { LandingHeader } from '@/components/LandingHeader'

export function OnboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="onboard-shell">
      <LandingHeader variant="onboard" />
      <main className="onboard-main">{children}</main>
    </div>
  )
}
