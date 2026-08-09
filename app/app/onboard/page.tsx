'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { ConnectWallet } from '@/components/ConnectWallet'
import { ApassGenerate } from '@/components/ApassGenerate'
import { NeoButton } from '@/components/neo/NeoButton'
import { useWalletSession } from '@/hooks/useWalletSession'
import { PERSONAS, personaById, type PersonaId } from '@/lib/personas'
import { setStoredPersona } from '@/lib/persona-session'

const PERSONA_VISUAL: Record<PersonaId, { num: string; glyph: string }> = {
  exporter: { num: '01', glyph: 'EX' },
  investor: { num: '02', glyph: 'IN' },
  compliance: { num: '03', glyph: 'CP' },
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function OnboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { address, isReady, isRestoring, isConnecting, phase } = useWalletSession()
  const [selected, setSelected] = useState<PersonaId | null>(null)
  const [hasApass, setHasApass] = useState(false)

  useEffect(() => {
    const fromUrl = searchParams.get('role')
    const persona = personaById(fromUrl)
    if (persona) setSelected(persona.id)
  }, [searchParams])

  const active = personaById(selected)
  const apassRequired = active?.id === 'investor' || active?.id === 'compliance'
  const canLaunch = Boolean(active && isReady && (!apassRequired || hasApass))

  const step = !selected ? 1 : !isReady ? 2 : canLaunch ? 4 : 3

  function selectPersona(id: PersonaId) {
    setSelected(id)
    setHasApass(false)
    setStoredPersona(id)
    router.replace(`/onboard?role=${id}`, { scroll: false })
  }

  function continueToApp() {
    if (!active || !canLaunch) return
    setStoredPersona(active.id)
    router.push(active.href)
  }

  return (
    <div className="onboard-page">
      <ol className="onboard-stepper" aria-label="Onboarding progress">
        <li
          className={`onboard-stepper__item ${step >= 1 ? 'onboard-stepper__item--done' : ''} ${step === 1 ? 'onboard-stepper__item--current' : ''}`}
        >
          <span className="onboard-stepper__num">1</span>
          <span className="onboard-stepper__label">Choose path</span>
        </li>
        <li
          className={`onboard-stepper__item ${step >= 2 ? 'onboard-stepper__item--done' : ''} ${step === 2 ? 'onboard-stepper__item--current' : ''}`}
        >
          <span className="onboard-stepper__num">2</span>
          <span className="onboard-stepper__label">Connect wallet</span>
        </li>
        <li
          className={`onboard-stepper__item ${step >= 3 ? 'onboard-stepper__item--done' : ''} ${step === 3 ? 'onboard-stepper__item--current' : ''}`}
        >
          <span className="onboard-stepper__num">3</span>
          <span className="onboard-stepper__label">
            {apassRequired ? 'Get A-Pass' : 'A-Pass (optional)'}
          </span>
        </li>
        <li
          className={`onboard-stepper__item ${step >= 4 ? 'onboard-stepper__item--done' : ''} ${step === 4 ? 'onboard-stepper__item--current' : ''}`}
        >
          <span className="onboard-stepper__num">4</span>
          <span className="onboard-stepper__label">Launch app</span>
        </li>
      </ol>

      <section className="onboard-section" aria-labelledby="onboard-personas-title">
        <h2 id="onboard-personas-title" className="onboard-section__title">
          Who are you here as?
        </h2>

        <div className="onboard-personas">
          {PERSONAS.map((persona) => {
            const visual = PERSONA_VISUAL[persona.id]
            const isActive = selected === persona.id
            return (
              <button
                key={persona.id}
                type="button"
                className={`onboard-persona-card ${isActive ? 'onboard-persona-card--active' : ''}`}
                onClick={() => selectPersona(persona.id)}
                aria-pressed={isActive}
              >
                <span className="onboard-persona-card__top">
                  <span className="onboard-persona-card__num">{visual.num}</span>
                  <span className="onboard-persona-card__glyph">{visual.glyph}</span>
                </span>
                <span className="onboard-persona-card__tag">{persona.subtitle}</span>
                <span className="onboard-persona-card__title">{persona.title}</span>
                <p className="onboard-persona-card__desc">{persona.description}</p>
                {isActive && <span className="onboard-persona-card__check" aria-hidden>✓</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section className="onboard-section onboard-wallet-panel" id="wallet-step" aria-labelledby="onboard-wallet-title">
        <div className="onboard-wallet-panel__inner">
          <div className="onboard-wallet-panel__copy">
            <h2 id="onboard-wallet-title" className="onboard-section__title">
              Connect wallet
            </h2>
            <p className="onboard-section__sub">Monad testnet · chain 10143</p>
          </div>

          <div className="onboard-wallet-panel__action">
            <div
              className={`onboard-wallet-status onboard-wallet-status--${phase}`}
              role="status"
              aria-live="polite"
            >
              {isRestoring && (
                <>
                  <span className="onboard-wallet-status__dot" />
                  Restoring…
                </>
              )}
              {isConnecting && !isRestoring && (
                <>
                  <span className="onboard-wallet-status__dot" />
                  Connecting…
                </>
              )}
              {!isRestoring && !isConnecting && isReady && address && (
                <>
                  <span className="onboard-wallet-status__dot onboard-wallet-status__dot--ok" />
                  <code>{shortAddress(address)}</code>
                </>
              )}
              {!isRestoring && !isConnecting && phase === 'wrong-network' && address && (
                <>
                  <span className="onboard-wallet-status__dot onboard-wallet-status__dot--warn" />
                  Wrong network
                </>
              )}
              {!isRestoring && !isConnecting && phase === 'disconnected' && (
                <>
                  <span className="onboard-wallet-status__dot onboard-wallet-status__dot--idle" />
                  Not connected
                </>
              )}
            </div>

            <div className="onboard-wallet-panel__connect">
              <ConnectWallet />
            </div>
          </div>
        </div>
      </section>

      {isReady && address && (
        <section className="onboard-section" aria-labelledby="onboard-apass-title">
          <h2 id="onboard-apass-title" className="onboard-section__title">
            {apassRequired ? 'A-Pass (required)' : 'A-Pass (optional)'}
          </h2>
          {apassRequired && !hasApass && (
            <p className="onboard-section__sub">
              Generate or verify an existing A-Pass before opening {active?.title ?? 'the app'}.
            </p>
          )}
          <ApassGenerate required={apassRequired} onStatusChange={setHasApass} />
        </section>
      )}

      {active && isReady && (
        <section className="onboard-launch" aria-labelledby="onboard-launch-title">
          <div className="onboard-launch__card">
            <h2 id="onboard-launch-title" className="onboard-launch__title">
              Enter as {active.title}
            </h2>
            {apassRequired && !hasApass ? (
              <p className="onboard-launch__gate neo-muted">
                Complete A-Pass onboarding above to continue.
              </p>
            ) : (
              <NeoButton className="onboard-launch__btn" onClick={continueToApp}>
                Open {active.title} →
              </NeoButton>
            )}
          </div>
        </section>
      )}

      {active && isReady && canLaunch && (
        <div className="onboard-sticky-cta">
          <NeoButton className="onboard-sticky-cta__btn" onClick={continueToApp}>
            Open {active.title} →
          </NeoButton>
        </div>
      )}
    </div>
  )
}

export default function OnboardPage() {
  return (
    <Suspense
      fallback={
        <div className="onboard-page">
          <p className="onboard-loading">Loading…</p>
        </div>
      }
    >
      <OnboardContent />
    </Suspense>
  )
}
