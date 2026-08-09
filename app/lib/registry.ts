import { getAddress, type Address, type Hex } from 'viem'
import { addresses, rpcUrl } from '@/lib/config'
import { invoiceRegistryAbi } from '@/lib/contracts'
import { monadTestnet } from '@/wagmi.config'
import { createPublicClient, http } from 'viem'

export type RegistryInvoice = {
  docHash: Hex
  pintProfileHash: Hex
  originator: Address
  obligor: Address
  faceValue: bigint
  dueDate: bigint
  registeredAt: bigint
  currency: Hex
  status: number
}

const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })

export async function readRegistryInvoice(invoiceId: Hex): Promise<RegistryInvoice | null> {
  try {
    const row = await client.readContract({
      address: addresses.registry,
      abi: invoiceRegistryAbi,
      functionName: 'get',
      args: [invoiceId],
    })
    const inv = row as RegistryInvoice
    if (Number(inv.status) === 0 && inv.registeredAt === BigInt(0)) return null
    return inv
  } catch {
    return null
  }
}

export function isSameAddress(a: string, b: string): boolean {
  try {
    return getAddress(a).toLowerCase() === getAddress(b).toLowerCase()
  } catch {
    return a.toLowerCase() === b.toLowerCase()
  }
}

export const ORIGINATOR_INVOICES_KEY = 'clearnote-originator-invoices'

export function loadPinnedInvoices(originator: string): Hex[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(ORIGINATOR_INVOICES_KEY)
    if (!raw) return []
    const map = JSON.parse(raw) as Record<string, string[]>
    const list = map[getAddress(originator).toLowerCase()] ?? []
    return list.filter((id) => /^0x[a-fA-F0-9]{64}$/.test(id)) as Hex[]
  } catch {
    return []
  }
}

export function savePinnedInvoice(originator: string, invoiceId: Hex): void {
  if (typeof window === 'undefined') return
  try {
    const key = getAddress(originator).toLowerCase()
    const raw = localStorage.getItem(ORIGINATOR_INVOICES_KEY)
    const map = (raw ? JSON.parse(raw) : {}) as Record<string, string[]>
    const existing = new Set((map[key] ?? []).map((x) => x.toLowerCase()))
    existing.add(invoiceId.toLowerCase())
    map[key] = [...existing]
    localStorage.setItem(ORIGINATOR_INVOICES_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}
