import type { PersonaId } from '@/lib/personas'
import { isPersonaId, writePersonaCookie } from '@/lib/persona-cookie'

const STORAGE_KEY = 'clearnote:persona'

export function getStoredPersona(): PersonaId | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return isPersonaId(raw) ? raw : null
  } catch {
    return null
  }
}

export function setStoredPersona(id: PersonaId): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, id)
    writePersonaCookie(id)
    window.dispatchEvent(new Event('clearnote-persona'))
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredPersona(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
    writePersonaCookie(null)
    window.dispatchEvent(new Event('clearnote-persona'))
  } catch {
    // ignore
  }
}

/** Keep cookie aligned when localStorage already has a persona (e.g. after upgrade). */
export function syncPersonaCookieFromStorage(): void {
  writePersonaCookie(getStoredPersona())
}
