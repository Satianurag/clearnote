'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getStoredPersona } from '@/lib/persona-session'
import type { PersonaId } from '@/lib/personas'
import { canAccessRoute } from '@/lib/persona-routes'

export type ProductLinkItem = {
  href: string
  label: string
}

function parseHref(href: string): { pathname: string; tab: string | null } {
  try {
    const url = new URL(href, 'http://clearnote.local')
    return { pathname: url.pathname, tab: url.searchParams.get('tab') }
  } catch {
    return { pathname: href.split('?')[0] ?? href, tab: null }
  }
}

export function ProductLinks({ items }: { items: ProductLinkItem[] }) {
  const [persona, setPersona] = useState<PersonaId | null>(null)

  useEffect(() => {
    setPersona(getStoredPersona())
    const sync = () => setPersona(getStoredPersona())
    window.addEventListener('storage', sync)
    window.addEventListener('clearnote-persona', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('clearnote-persona', sync)
    }
  }, [])

  const visible = useMemo(() => {
    if (!persona) return []
    return items.filter((item) => {
      const { pathname, tab } = parseHref(item.href)
      return canAccessRoute(persona, pathname, tab)
    })
  }, [items, persona])

  if (visible.length === 0) return null

  return (
    <p className="product-links">
      {visible.map((item, index) => (
        <span key={item.href}>
          {index > 0 && ' · '}
          <Link href={item.href}>{item.label}</Link>
        </span>
      ))}
    </p>
  )
}
