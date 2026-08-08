'use client'

import Link from 'next/link'
import { useAccount, useReadContract } from 'wagmi'
import { getAddress } from 'viem'
import { addresses, demoWallets, rpcUrl } from '@/lib/config'
import { REASON_CODES } from '@/lib/reasonCodes'
import { monadTestnet } from '@/wagmi.config'
import { erc20Abi } from '@/lib/contracts'

const DEAD = demoWallets.dead
const AMOUNT = BigInt('1000000000000000000')

export default function InvestorPage() {
  const { address } = useAccount()
  const buyer = address ?? demoWallets.b

  const balance = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.clinv01,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [buyer],
  })

  const preflight = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.clearNotePolicy,
    abi: [
      {
        name: 'inspect',
        type: 'function',
        stateMutability: 'view',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [
          { name: 'ok', type: 'bool' },
          { name: 'code', type: 'bytes4' },
          { name: 'reason', type: 'string' },
        ],
      },
    ],
    functionName: 'inspect',
    args: [addresses.clinv01, demoWallets.b, getAddress(DEAD), AMOUNT],
  })

  const ok = preflight.data?.[0]
  const code = preflight.data?.[1] as string | undefined
  const sel = code?.slice(0, 10)?.toLowerCase()
  const reason = sel ? (REASON_CODES[sel] ?? code) : '…'

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui' }}>
      <h1>Investor — Offer book & DvP</h1>
      <p>
        DvPEscrow <code>{addresses.dvpEscrow}</code> · pre-flight via policy{' '}
        <code>{addresses.clearNotePolicy}</code>
      </p>
      <section style={{ marginTop: 16, padding: 12, background: '#f4f4f4', borderRadius: 8 }}>
        <h3>Why did this fail? (B → no-A-Pass sink)</h3>
        <p>Result: {ok ? 'PASS' : 'DENY'}</p>
        <p>Selector: <code>{sel ?? 'loading'}</code></p>
        <p>Layer: {sel?.startsWith('0x8') || sel === '0xe3e32fdb' ? 'ClearNote' : 'Cleanverse'}</p>
        <p>{reason}</p>
        <p style={{ color: '#666', fontSize: 13 }}>
          Buy button stays disabled when simulate/inspect denies — intentional UX (WO-10).
        </p>
      </section>
      <p style={{ marginTop: 16 }}>
        CLINV01 balance ({buyer.slice(0, 10)}…): {balance.data?.toString() ?? '…'}
      </p>
      <p>
        <Link href="/transfers">Live transfer demo</Link> ·{' '}
        <Link href="/compliance/matrix">Compliance matrix</Link> ·{' '}
        <Link href="/minidvp">MiniDvP</Link>
      </p>
      <p className="muted" style={{ fontSize: 13 }}>RPC {rpcUrl}</p>
    </main>
  )
}
