import Link from 'next/link'

const links = [
  { href: '/', label: 'Home' },
  { href: '/onboard', label: 'Get started' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/exporter', label: 'Exporter' },
  { href: '/obligor', label: 'Obligor accept' },
  { href: '/exporter?tab=originator', label: 'Originator' },
  { href: '/investor', label: 'Investor' },
  { href: '/compliance/matrix', label: 'Compliance matrix' },
  { href: '/compliance?tab=regulator', label: 'Regulator' },
  { href: '/transfers', label: 'Wallet transfer' },
  { href: '/activity', label: 'Indexed activity' },
]

export function Nav() {
  return (
    <nav style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
      {links.map((l) => (
        <Link key={l.href} href={l.href} style={{ color: '#0b5fff', textDecoration: 'none' }}>
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
