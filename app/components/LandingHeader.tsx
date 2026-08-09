'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ConnectWallet } from '@/components/ConnectWallet'

const MARQUEE_TEXT = 'TURN INVOICES INTO CASH • REAL TRADE • NO FRAUD • NO WAITING • '

const NAV = [
  { href: '/#how', label: 'How it works' },
  { href: '/#proof', label: 'Live proof' },
  { href: '/#why', label: 'Why different' },
] as const

type Props = {
  /** Landing: yellow CTA to /onboard. Onboard: wallet connect instead. */
  variant?: 'landing' | 'onboard'
  getStartedHref?: string
}

/** Header + top marquee copied from `public/landing.html` (neobrutalist chrome). */
export function LandingHeader({ variant = 'landing', getStartedHref = '/onboard' }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)

  function closeMenu() {
    setMenuOpen(false)
  }

  return (
    <>
      <div className="lh-marquee" aria-hidden>
        <div className="lh-marquee__track">
          {Array.from({ length: 2 }).map((_, group) => (
            <div key={group} className="lh-marquee__group">
              {Array.from({ length: 6 }).map((__, i) => (
                <span key={i} className="lh-marquee__item">
                  {MARQUEE_TEXT}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      <header className="lh-header">
        <div className="lh-header__wrap">
          <div className="lh-header__row">
            <Link href="/" className="lh-brand" onClick={closeMenu}>
              <div className="lh-brand__mark">
                <span className="lh-brand__letter">C</span>
              </div>
              <span className="lh-brand__name">CLEARNOTE</span>
              <span className="lh-brand__badge">TESTNET</span>
            </Link>

            <nav className="lh-nav" aria-label="Primary">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="lh-nav__link">
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="lh-actions">
              <a
                href="https://github.com/Satianurag/clearnote"
                target="_blank"
                rel="noreferrer"
                className="lh-btn lh-btn--ghost lh-btn--github"
              >
                GitHub
              </a>
              {variant === 'onboard' ? (
                <div className="lh-actions__wallet">
                  <ConnectWallet />
                </div>
              ) : (
                <Link href={getStartedHref} className="lh-btn lh-btn--primary" onClick={closeMenu}>
                  Get started
                </Link>
              )}
              <button
                type="button"
                className="lh-menu-toggle"
                aria-label="Toggle menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav className="lh-mobile-nav" aria-label="Mobile">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="lh-mobile-nav__link" onClick={closeMenu}>
                  {item.label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>
    </>
  )
}
