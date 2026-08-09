import type { PersonaId } from '@/lib/personas'
import { PERSONAS } from '@/lib/personas'

export type RouteAccess = PersonaId[] | 'all'

/** Who may open this product route (matches Nav.tsx intent). */
export function resolveRouteAccess(pathname: string, tab: string | null): RouteAccess {
  switch (pathname) {
    case '/dashboard':
      return 'all'
    case '/activity':
      return ['compliance']
    case '/exporter':
    case '/obligor':
      return ['exporter']
    case '/investor':
      return ['investor']
    case '/compliance/matrix':
      return ['compliance']
    case '/compliance':
      return tab === 'regulator' ? ['compliance'] : ['compliance']
    case '/debug/transfers':
    case '/debug/minidvp':
    case '/transfers':
    case '/minidvp':
      return ['exporter', 'investor']
    default:
      return 'all'
  }
}

export function canAccessRoute(
  persona: PersonaId | null,
  pathname: string,
  tab: string | null,
): boolean {
  if (!persona) return false
  const access = resolveRouteAccess(pathname, tab)
  if (access === 'all') return true
  return access.includes(persona)
}

export function personaHomePath(persona: PersonaId): string {
  return PERSONAS.find((p) => p.id === persona)?.href ?? '/dashboard'
}

export function personaDeniedMessage(persona: PersonaId, pathname: string): string {
  const label = PERSONAS.find((p) => p.id === persona)?.title ?? persona
  return `That page isn’t available in ${label} mode — redirected to your workspace.`
}

export const PERSONA_DENIED_STORAGE_KEY = 'clearnote:persona-denied'

export type QuickLink = {
  title: string
  description: string
  href: string
}

export function quickLinksForPersona(persona: PersonaId, wallet?: string): QuickLink[] {
  const activityHref = wallet ? `/activity?wallet=${encodeURIComponent(wallet)}` : '/activity'

  switch (persona) {
    case 'exporter':
      return [
        {
          title: 'Exporter upload',
          description: 'Register PINT-SG invoices, validate, and hand off to obligor.',
          href: '/exporter',
        },
        {
          title: 'Originator portfolio',
          description: 'Finance accepted invoices via Safe and track lifecycle.',
          href: '/exporter?tab=originator',
        },
        {
          title: 'Obligor accept',
          description: 'EIP-712 acceptance for registered invoices.',
          href: '/obligor',
        },
      ]
    case 'investor':
      return [
        {
          title: 'Investor desk',
          description: 'Positions, DvP offer book, Cleanverse pre-flight.',
          href: '/investor',
        },
      ]
    case 'compliance':
      return [
        {
          title: 'A-Pass lookup',
          description: 'Cleanverse CVI — verify wallet eligibility on Monad sandbox.',
          href: '/compliance',
        },
        {
          title: 'Compliance matrix',
          description: 'Live inspect() reference wallets and reason codes.',
          href: '/compliance/matrix',
        },
        {
          title: 'Regulator',
          description: 'OFAC merkle roots, audit packs, denial log.',
          href: '/compliance?tab=regulator',
        },
        {
          title: 'Indexed activity',
          description: 'ERC20 transfer history from the Envio indexer.',
          href: activityHref,
        },
      ]
    default:
      return []
  }
}

const EXPORTER_PENDING = new Set(['obligor_accept', 'finance', 'await_obligor', 'settle'])
const INVESTOR_PENDING = new Set(['trade_dvp'])

export function pendingActionAllowedForPersona(persona: PersonaId, actionType: string): boolean {
  if (EXPORTER_PENDING.has(actionType)) return persona === 'exporter'
  if (INVESTOR_PENDING.has(actionType)) return persona === 'investor'
  return false
}

export function showDeveloperToolsForPersona(persona: PersonaId): boolean {
  return persona === 'exporter' || persona === 'investor'
}
