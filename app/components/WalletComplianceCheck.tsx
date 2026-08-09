'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, getAddress, http } from 'viem'
import { useAccount } from 'wagmi'
import { NeoCard } from '@/components/neo/NeoCard'
import { clearNotePolicyAbi } from '@/lib/contracts'
import { addresses, demoWallets, rpcUrl } from '@/lib/config'
import { REASON_CODES } from '@/lib/reasonCodes'

const client = createPublicClient({ transport: http(rpcUrl) })
const AMOUNT = BigInt('1000000000000000000')

function formatSelector(code: string): string {
  const hex = code.startsWith('0x') ? code : `0x${code}`
  return hex.length >= 10 ? hex.slice(0, 10) : hex
}

export function WalletComplianceCheck() {
  const { address } = useAccount()
  const [row, setRow] = useState<{
    ok: boolean
    code: string
    reason: string
    loading: boolean
    error?: string
  } | null>(null)

  useEffect(() => {
    if (!address) {
      setRow(null)
      return
    }

    let cancelled = false
    async function inspect() {
      setRow({ ok: false, code: '…', reason: 'Loading…', loading: true })
      const from = getAddress(demoWallets.b)
      const to = getAddress(address as `0x${string}`)
      try {
        const [ok, code, reasonText] = await client.readContract({
          address: addresses.clearNotePolicy,
          abi: clearNotePolicyAbi,
          functionName: 'inspect',
          args: [addresses.clinv01, from, to, AMOUNT],
        })
        const sel = formatSelector(code as string)
        if (!cancelled) {
          setRow({
            ok: ok as boolean,
            code: sel,
            reason:
              REASON_CODES[sel.toLowerCase()] ??
              (typeof reasonText === 'string' && reasonText.length > 0
                ? reasonText
                : ok
                  ? 'Transfer permitted'
                  : sel),
            loading: false,
          })
        }
      } catch (e) {
        if (!cancelled) {
          setRow({
            ok: false,
            code: 'error',
            reason: String(e),
            loading: false,
            error: String(e),
          })
        }
      }
    }

    inspect()
    return () => {
      cancelled = true
    }
  }, [address])

  if (!address) return null

  return (
    <NeoCard className="wallet-compliance-check">
      <h2 className="dvp-section__title">Your connected wallet</h2>
      <p className="neo-muted" style={{ fontSize: 14 }}>
        CLINV01 transfer B (ref investor) → <code>{address}</code>
      </p>
      {row?.loading ? (
        <p>Inspecting policy…</p>
      ) : row ? (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ padding: '4px 8px 4px 0' }}>Result</td>
              <td>{row.ok ? 'PASS' : 'DENY'}</td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px 4px 0' }}>Selector</td>
              <td><code>{row.code}</code></td>
            </tr>
            <tr>
              <td style={{ padding: '4px 8px 4px 0' }}>Reason</td>
              <td>{row.reason}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </NeoCard>
  )
}
