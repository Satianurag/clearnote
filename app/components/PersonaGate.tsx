'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { useToast } from '@/context/ToastContext'
import { getStoredPersona, syncPersonaCookieFromStorage } from '@/lib/persona-session'
import {
  PERSONA_DENIED_STORAGE_KEY,
  canAccessRoute,
  personaDeniedMessage,
  personaHomePath,
} from '@/lib/persona-routes'

function PersonaGateInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const tab = searchParams.get('tab')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setReady(false)

    syncPersonaCookieFromStorage()
    const persona = getStoredPersona()
    const returnTo = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    if (!persona) {
      router.replace(`/onboard?next=${encodeURIComponent(returnTo)}`)
      return
    }

    if (!canAccessRoute(persona, pathname, tab)) {
      try {
        sessionStorage.setItem(PERSONA_DENIED_STORAGE_KEY, personaDeniedMessage(persona, pathname))
      } catch {
        // ignore private mode
      }
      router.replace(personaHomePath(persona))
      return
    }

    try {
      const denied = sessionStorage.getItem(PERSONA_DENIED_STORAGE_KEY)
      if (denied) {
        sessionStorage.removeItem(PERSONA_DENIED_STORAGE_KEY)
        toast.info(denied)
      }
    } catch {
      // ignore
    }

    setReady(true)
  }, [pathname, tab, router, searchParams, toast])

  if (!ready) {
    return <p className="neo-muted product-loading">Checking your role…</p>
  }

  return <>{children}</>
}

/** Blocks product routes until a stored persona can access the current path. */
export function PersonaGate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="neo-muted product-loading">Checking your role…</p>}>
      <PersonaGateInner>{children}</PersonaGateInner>
    </Suspense>
  )
}
