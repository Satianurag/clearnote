import type { PersonaId } from '@/lib/personas'

export const PERSONA_COOKIE = 'clearnote-persona'

export const VALID_PERSONAS: PersonaId[] = ['exporter', 'investor', 'compliance']

export function isPersonaId(value: string | null | undefined): value is PersonaId {
  return Boolean(value && VALID_PERSONAS.includes(value as PersonaId))
}

/** Browser-only — mirrors localStorage persona for API route guards. */
export function writePersonaCookie(persona: PersonaId | null): void {
  if (typeof document === 'undefined') return
  if (persona) {
    document.cookie = `${PERSONA_COOKIE}=${persona}; path=/; max-age=31536000; SameSite=Lax`
  } else {
    document.cookie = `${PERSONA_COOKIE}=; path=/; max-age=0; SameSite=Lax`
  }
}
