import type { PersonaId } from '@/lib/personas'

const STORAGE_KEY = 'clearnote:persona'

const VALID: PersonaId[] = ['exporter', 'investor', 'compliance']

export function getStoredPersona(): PersonaId | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return VALID.includes(raw as PersonaId) ? (raw as PersonaId) : null
  } catch {
    return null
  }
}

export function setStoredPersona(id: PersonaId): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, id)
    window.dispatchEvent(new Event('clearnote-persona'))
  } catch {
    // ignore quota / private mode
  }
}

export function clearStoredPersona(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
