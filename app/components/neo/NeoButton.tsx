import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  children: ReactNode
}

export function NeoButton({ variant = 'primary', className = '', children, ...props }: Props) {
  return (
    <button type="button" className={`neo-btn neo-btn--${variant} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
