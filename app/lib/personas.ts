export type PersonaId = 'exporter' | 'investor' | 'compliance'

export type Persona = {
  id: PersonaId
  title: string
  subtitle: string
  description: string
  href: string
}

/** Post-onboarding entry routes — wallet required on destination pages. */
export const PERSONAS: Persona[] = [
  {
    id: 'exporter',
    title: 'Exporter',
    subtitle: 'Turn invoices into cash',
    description: 'Upload a trade invoice, validate PINT-SG, and register on-chain from your wallet.',
    href: '/exporter',
  },
  {
    id: 'investor',
    title: 'Investor',
    subtitle: 'Buy verified notes',
    description: 'Connect your wallet for live A-Pass verification, policy pre-flight, and DvP settlement.',
    href: '/investor',
  },
  {
    id: 'compliance',
    title: 'Compliance',
    subtitle: 'Verify & audit',
    description: 'Look up A-Pass status and browse the live on-chain reason-code matrix.',
    href: '/compliance',
  },
]

export function personaById(id: string | null | undefined): Persona | undefined {
  return PERSONAS.find((p) => p.id === id)
}
