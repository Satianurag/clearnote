import Link from 'next/link'

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/transfers', label: 'Wallet transfer' },
  { href: '/activity', label: 'Indexed activity' },
  { href: '/minidvp', label: 'MiniDvP' },
  { href: '/compliance', label: 'A-Pass lookup' },
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
