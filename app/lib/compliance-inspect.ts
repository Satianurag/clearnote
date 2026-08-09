import { createPublicClient, getAddress, http, type Address } from 'viem'
import { addresses, demoWallets, rpcUrl } from '@/lib/config'
import { clearNotePolicyAbi } from '@/lib/contracts'
import { DEFAULT_INSPECT_UNITS } from '@/lib/inspect'
import { REASON_CODES, reasonMetaForSelector } from '@/lib/reasonCodes'
import { withTimeout } from '@/lib/rpc-timeout'

/** First real SDN EVM address from seed/ofac/ofac-root.json */
export const REF_SANCTIONED = '0x098b716b8aaf21512996dc57eb0615e2383e2f96' as const

export const COMPLIANCE_REF_WALLETS = [
  { label: 'Ref: issuer', addr: demoWallets.a },
  { label: 'Ref: investor', addr: demoWallets.b },
  { label: 'Ref: investor B2', addr: demoWallets.b2 },
  { label: 'Ref: frozen', addr: demoWallets.c },
  { label: 'Ref: tier-low', addr: demoWallets.e },
  { label: 'Ref: no A-Pass', addr: demoWallets.dead },
  { label: 'Ref: sanctioned (SDN)', addr: REF_SANCTIONED },
] as const

export const INSPECT_TIMEOUT_MS = 8_000

const client = createPublicClient({ transport: http(rpcUrl) })

export type InspectRow = {
  wallet: string
  to: Address
  ok: boolean
  code: string
  reason: string
  enforcedBy: string
  layer: string
}

function formatSelector(code: string): string {
  const hex = code.startsWith('0x') ? code : `0x${code}`
  return hex.length >= 10 ? hex.slice(0, 10) : hex
}

export async function inspectTransfer(
  label: string,
  to: Address,
  from: Address = getAddress(COMPLIANCE_REF_WALLETS[1].addr),
  amount: bigint = DEFAULT_INSPECT_UNITS,
): Promise<InspectRow> {
  try {
    const [ok, code, reasonText] = await withTimeout(
      client.readContract({
        address: addresses.clearNotePolicy,
        abi: clearNotePolicyAbi,
        functionName: 'inspect',
        args: [addresses.clinv01, from, to, amount],
      }),
      INSPECT_TIMEOUT_MS,
      `inspect ${label}`,
    )
    const sel = formatSelector(code as string)
    const meta = reasonMetaForSelector(sel)
    return {
      wallet: label,
      to,
      ok: ok as boolean,
      code: sel,
      reason:
        REASON_CODES[sel.toLowerCase()] ??
        (typeof reasonText === 'string' && reasonText.length > 0
          ? reasonText
          : ok
            ? 'Transfer permitted'
            : sel),
      enforcedBy: meta?.enforcedBy ?? (ok ? '—' : 'Unknown'),
      layer: meta?.layer ?? '—',
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      wallet: label,
      to,
      ok: false,
      code: 'error',
      reason: msg,
      enforcedBy: '—',
      layer: '—',
    }
  }
}

export async function runComplianceMatrixInspect(): Promise<InspectRow[]> {
  const from = getAddress(COMPLIANCE_REF_WALLETS[1].addr)
  return Promise.all(
    COMPLIANCE_REF_WALLETS.map((w) =>
      inspectTransfer(w.label, getAddress(w.addr), from, DEFAULT_INSPECT_UNITS),
    ),
  )
}
