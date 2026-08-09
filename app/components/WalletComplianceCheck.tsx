'use client'

import { useEffect, useState } from 'react'
import { createPublicClient, getAddress, http } from 'viem'
import { useAccount } from 'wagmi'
import { NeoCard } from '@/components/neo/NeoCard'
import { clearNotePolicyAbi } from '@/lib/contracts'
import { addresses, demoWallets, rpcUrl } from '@/lib/config'
import { DEFAULT_INSPECT_UNITS } from '@/lib/inspect'
import { REASON_CODES } from '@/lib/reasonCodes'

const client = createPublicClient({ transport: http(rpcUrl) })

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
          args: [addresses.clinv01, from, to, DEFAULT_INSPECT_UNITS],
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
      <h2 className="wallet-compliance-check__title">Your connected wallet</h2>
      <p className="neo-muted wallet-compliance-check__lead">
        CLINV01 transfer B (ref investor) → <code>{address}</code>
      </p>
      {row?.loading ? (
        <p>Inspecting policy…</p>
      ) : row ? (
        <table className="neo-table wallet-compliance-check__table">
          <tbody>
            <tr>
              <th scope="row">Result</th>
              <td className={row.ok ? 'ok' : 'error'}>{row.ok ? 'PASS' : 'DENY'}</td>
            </tr>
            <tr>
              <th scope="row">Selector</th>
              <td>
                <code>{row.code}</code>
              </td>
            </tr>
            <tr>
              <th scope="row">Reason</th>
              <td>{row.reason}</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </NeoCard>
  )
}
