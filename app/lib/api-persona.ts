import { NextRequest, NextResponse } from 'next/server'
import { PERSONA_COOKIE, isPersonaId } from '@/lib/persona-cookie'
import type { PersonaId } from '@/lib/personas'

export type PersonaGuardPolicy =
  | { mode: 'optional' }
  | { mode: 'any' }
  | { mode: 'roles'; roles: PersonaId[] }

export function getPersonaFromRequest(request: NextRequest): PersonaId | null {
  const raw = request.cookies.get(PERSONA_COOKIE)?.value
  return isPersonaId(raw) ? raw : null
}

export function guardApiPersona(
  request: NextRequest,
  policy: PersonaGuardPolicy,
): NextResponse | null {
  const persona = getPersonaFromRequest(request)

  if (policy.mode === 'optional') return null

  if (!persona) {
    return NextResponse.json(
      { error: 'Choose a role during onboarding before using this API.' },
      { status: 403 },
    )
  }

  if (policy.mode === 'any') return null

  if (!policy.roles.includes(persona)) {
    return NextResponse.json(
      { error: `This API is not available for the ${persona} role.` },
      { status: 403 },
    )
  }

  return null
}

export function indexerOpPolicy(op: string | null): PersonaGuardPolicy {
  switch (op) {
    case 'offers':
      return { mode: 'roles', roles: ['investor'] }
    case 'compliance':
    case 'transfers':
      return { mode: 'roles', roles: ['compliance'] }
    default:
      return { mode: 'any' }
  }
}
