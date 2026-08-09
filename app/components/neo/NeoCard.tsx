import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  accent?: boolean
}

export function NeoCard({ children, className = '', accent = false }: Props) {
  return (
    <div className={`neo-card ${accent ? 'neo-card--accent' : ''} ${className}`.trim()}>{children}</div>
  )
}
