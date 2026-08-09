'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import type { PersonaId } from '@/lib/personas'
import { getStoredPersona } from '@/lib/persona-session'

type NavLink = {
  href: string
  label: string
  match?: 'exact' | 'prefix' | 'query'
  queryKey?: string
  queryValue?: string
  personas?: PersonaId[]
}

const LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', match: 'exact' },
  {
    href: '/exporter',
    label: 'Exporter',
    match: 'prefix',
    personas: ['exporter'],
  },
  { href: '/obligor', label: 'Obligor accept', match: 'exact', personas: ['exporter'] },
  {
    href: '/exporter?tab=originator',
    label: 'Originator',
    match: 'query',
    queryKey: 'tab',
    queryValue: 'originator',
    personas: ['exporter'],
  },
  { href: '/investor', label: 'Investor', match: 'exact', personas: ['investor'] },
  {
    href: '/compliance/matrix',
    label: 'Compliance matrix',
    match: 'exact',
    personas: ['investor', 'compliance'],
  },
  {
    href: '/compliance?tab=regulator',
    label: 'Regulator',
    match: 'query',
    queryKey: 'tab',
    queryValue: 'regulator',
    personas: ['compliance'],
  },
  { href: '/compliance', label: 'A-Pass lookup', match: 'exact', personas: ['compliance'] },
  { href: '/activity', label: 'Indexed activity', match: 'exact' },
]

function isActive(link: NavLink, pathname: string, tab: string | null): boolean {
  if (link.match === 'query') {
    return pathname === link.href.split('?')[0] && tab === link.queryValue
  }
  if (link.match === 'prefix') {
    return pathname === link.href || (pathname.startsWith('/exporter') && !tab)
  }
  return pathname === link.href
}

function NavLinks() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tab = searchParams.get('tab')
  const [persona, setPersona] = useState<PersonaId | null>(null)

  useEffect(() => {
    setPersona(getStoredPersona())
    const onStorage = () => setPersona(getStoredPersona())
    window.addEventListener('storage', onStorage)
    window.addEventListener('clearnote-persona', onStorage)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('clearnote-persona', onStorage)
    }
  }, [pathname])

  const links = useMemo(() => {
    if (!persona) return LINKS
    return LINKS.filter((link) => !link.personas || link.personas.includes(persona))
  }, [persona])

  return (
    <nav className="product-nav" aria-label="Product navigation">
      {links.map((link) => {
        const active = isActive(link, pathname, tab)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`product-nav__link${active ? ' product-nav__link--active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Nav() {
  return (
    <Suspense fallback={<nav className="product-nav" aria-label="Product navigation" />}>
      <NavLinks />
    </Suspense>
  )
}
