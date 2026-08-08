'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { getAddress } from 'viem'
import { addresses, demoWallets, explorerUrl, rpcUrl } from '@/lib/config'
import { REASON_CODES } from '@/lib/reasonCodes'
import { monadTestnet } from '@/wagmi.config'
import { erc20Abi } from '@/lib/contracts'

const DEAD = demoWallets.dead
const AMOUNT = BigInt('1000000000000000000')

type VerifyRow = { atoken: string; label: string; code?: number; message?: string; ok: boolean }

export default function InvestorPage() {
  const { address } = useAccount()
  const buyer = address ?? demoWallets.b

  const [verifyRows, setVerifyRows] = useState<VerifyRow[]>([])
  const [validatorReg, setValidatorReg] = useState<boolean | null>(null)
  const [validatorValid, setValidatorValid] = useState<boolean | null>(null)
  const [rampQuote, setRampQuote] = useState<Record<string, unknown> | null>(null)
  const [rampError, setRampError] = useState<string | null>(null)
  const [cvaPair, setCvaPair] = useState<{ origin?: string; atoken?: string } | null>(null)

  const balanceNote = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.clinv01,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [buyer],
  })

  const balanceCash = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.cashToken,
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

  useEffect(() => {
    let cancelled = false
    async function loadCva() {
      const [depRes, vNote, vCash, valReg, valVerify, ramp] = await Promise.all([
        fetch('/api/cleanverse/deposit-atokens').then((r) => r.json()),
        fetch('/api/cleanverse/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain: 'monad', atoken: addresses.clinv01, address: buyer }),
        }).then((r) => r.json()),
        fetch('/api/cleanverse/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chain: 'monad', atoken: addresses.cashToken, address: buyer }),
        }).then((r) => r.json()),
        fetch('/api/cleanverse/validator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chain: 'monad',
            contract_address: addresses.compliancePool,
            action: 'is_register',
          }),
        }).then((r) => r.json()),
        fetch('/api/cleanverse/validator', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chain: 'monad',
            contract_address: addresses.compliancePool,
            user_address: buyer,
            action: 'verify',
          }),
        }).then((r) => r.json()),
        fetch('/api/cleanverse/ramp/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fiatAmount: 500, network: 'monad' }),
        }).then((r) => r.json()),
      ])

      if (cancelled) return

      const tokens = (depRes.data as { tokens?: Array<{ origin_token?: { address?: string }; atoken?: { address?: string; symbol?: string } }> })?.tokens
      const pair = tokens?.find((t) => t.atoken?.address?.toLowerCase() === addresses.cashToken.toLowerCase())
      if (pair) {
        setCvaPair({ origin: pair.origin_token?.address, atoken: pair.atoken?.address })
      }

      const noteData = vNote.data as { code?: number; message?: string } | undefined
      const cashData = vCash.data as { code?: number; message?: string } | undefined
      setVerifyRows([
        {
          atoken: addresses.clinv01,
          label: 'CLINV01 (RWA note)',
          code: noteData?.code,
          message: noteData?.message,
          ok: noteData?.code === 4,
        },
        {
          atoken: addresses.cashToken,
          label: 'aUSDC (CVA cash leg)',
          code: cashData?.code,
          message: cashData?.message,
          ok: cashData?.code === 4,
        },
      ])

      setValidatorReg((valReg.data as { registered?: boolean } | undefined)?.registered ?? false)
      const valid = (valVerify.data as { valid?: boolean } | undefined)?.valid
      setValidatorValid(valid ?? false)

      if (ramp.ok && ramp.data) {
        setRampQuote(ramp.data as Record<string, unknown>)
        setRampError(null)
      } else {
        setRampQuote(null)
        setRampError(String(ramp.message ?? ramp.code))
      }
    }
    loadCva().catch((e) => setRampError(String(e)))
    return () => {
      cancelled = true
    }
  }, [buyer])

  const ok = preflight.data?.[0]
  const code = preflight.data?.[1] as string | undefined
  const sel = code?.slice(0, 10)?.toLowerCase()
  const reason = sel ? (REASON_CODES[sel] ?? code) : '…'
  const bothVerifyOk = verifyRows.length === 2 && verifyRows.every((r) => r.ok)

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
      <h1>Investor — Offer book & DvP (CVA settlement)</h1>
      <p>
        DvPEscrow <code>{addresses.dvpEscrow}</code> · cash leg{' '}
        <code>{addresses.cashToken}</code> (aUSDC) · note <code>{addresses.clinv01}</code>
      </p>

      <section style={{ marginTop: 16, padding: 12, background: '#f0f7ff', borderRadius: 8 }}>
        <h3>CVI · CVA pre-flight (live Cleanverse API)</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
              <th>Leg</th>
              <th>verify_apass</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {verifyRows.map((r) => (
              <tr key={r.atoken} style={{ borderBottom: '1px solid #eee' }}>
                <td>{r.label}</td>
                <td>{r.ok ? 'PASS (4)' : r.code != null ? `DENY (${r.code})` : '…'}</td>
                <td>{r.message ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {cvaPair && (
          <p style={{ fontSize: 13, color: '#444', marginTop: 8 }}>
            CVA pair from <code>query_deposit_atoken_list</code>: origin USDC{' '}
            <code>{cvaPair.origin}</code> → aUSDC <code>{cvaPair.atoken}</code>
          </p>
        )}
      </section>

      <section style={{ marginTop: 16, padding: 12, background: '#f4f4f4', borderRadius: 8 }}>
        <h3>ClearNote policy inspect (note leg)</h3>
        <p>Result: {ok ? 'PASS' : 'DENY'}</p>
        <p>
          Selector: <code>{sel ?? 'loading'}</code>
        </p>
        <p>Layer: {sel?.startsWith('0x8') || sel === '0xe3e32fdb' ? 'ClearNote' : 'Cleanverse'}</p>
        <p>{reason}</p>
      </section>

      <section style={{ marginTop: 16, padding: 12, background: '#fff8f0', borderRadius: 8 }}>
        <h3>Validator compliance pool (CCP)</h3>
        <p>
          Pool <code>{addresses.compliancePool}</code> · Validator{' '}
          <code>{addresses.cleanverseValidator}</code>
        </p>
        <p>
          Registered:{' '}
          {validatorReg === null ? '…' : validatorReg ? 'yes' : 'no — run pnpm validator:register-pool'}
        </p>
        <p>
          validator/verify buyer:{' '}
          {validatorValid === null ? '…' : validatorValid ? 'valid' : 'invalid'}
        </p>
        <p style={{ fontSize: 13, color: '#444' }}>
          Settlement: DvPEscrow <code>{addresses.dvpEscrow}</code> (Safe admin) — on-chain{' '}
          <code>inspect()</code> on note leg.
        </p>
      </section>

      <section style={{ marginTop: 16, padding: 12, background: '#f0fff4', borderRadius: 8 }}>
        <h3>Fiat Ramp quote (fund aUSDC)</h3>
        {rampQuote ? (
          <pre style={{ fontSize: 12, overflow: 'auto' }}>{JSON.stringify(rampQuote, null, 2)}</pre>
        ) : (
          <p style={{ color: '#666', fontSize: 13 }}>{rampError ?? 'Loading quote…'}</p>
        )}
      </section>

      <section style={{ marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>Balances ({buyer.slice(0, 10)}…)</h3>
        <p>CLINV01: {balanceNote.data?.toString() ?? '…'}</p>
        <p>aUSDC: {balanceCash.data?.toString() ?? '…'}</p>
        <p style={{ fontSize: 13, color: bothVerifyOk ? '#060' : '#900' }}>
          DvP ready: {bothVerifyOk && ok ? 'both legs pass pre-flight' : 'blocked until verify + inspect pass'}
        </p>
      </section>

      <p style={{ marginTop: 16 }}>
        <Link href="/transfers">Live transfer demo</Link> ·{' '}
        <Link href="/compliance/matrix">Compliance matrix</Link> ·{' '}
        <Link href="/minidvp">MiniDvP (aUSDC)</Link> ·{' '}
        <a href={`${explorerUrl}/address/${addresses.dvpEscrow}`}>DvP on Monadscan</a>
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        RPC {rpcUrl}
      </p>
    </main>
  )
}
