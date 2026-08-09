'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { getAddress, parseUnits } from 'viem'
import { formatTokenAmount } from '@/lib/format'
import { DvPOfferBook } from '@/components/DvPOfferBook'
import { DvPPostOffer } from '@/components/DvPPostOffer'
import { InvestorPositions } from '@/components/InvestorPositions'
import { ProductLinks } from '@/components/ProductLinks'
import { NeoCard } from '@/components/neo/NeoCard'
import { WalletGate } from '@/components/WalletGate'
import { addresses, demoWallets, explorerUrl } from '@/lib/config'
import { DEFAULT_INSPECT_UNITS } from '@/lib/inspect'
import { REASON_CODES } from '@/lib/reasonCodes'
import { monadTestnet } from '@/wagmi.config'
import { clearNotePolicyAbi, erc20Abi } from '@/lib/contracts'
import { useErrorToast } from '@/hooks/useErrorToast'

/** Reference DvP seller (wallet B2) — matches seeded offer makers on testnet. */
const REF_OFFER_MAKER = demoWallets.b2
const NO_APASS_SINK = demoWallets.dead
/** Default 1 CLINV01 — user can raise to match a real fill size before signing. */
const DEFAULT_INSPECT_UNITS_LOCAL = DEFAULT_INSPECT_UNITS

type VerifyRow = { atoken: string; label: string; code?: number; message?: string; ok: boolean }

function InvestorDesk({ buyer }: { buyer: `0x${string}` }) {
  const [offerRefresh, setOfferRefresh] = useState(0)
  const [inspectUnitsStr, setInspectUnitsStr] = useState('1')
  const inspectUnits = useMemo(() => {
    try {
      const v = parseUnits(inspectUnitsStr || '0', 18)
      return v > BigInt(0) ? v : DEFAULT_INSPECT_UNITS_LOCAL
    } catch {
      return DEFAULT_INSPECT_UNITS_LOCAL
    }
  }, [inspectUnitsStr])
  const [verifyRows, setVerifyRows] = useState<VerifyRow[]>([])
  const [cviError, setCviError] = useState<string | null>(null)
  const [validatorReg, setValidatorReg] = useState<boolean | null>(null)
  const [validatorValid, setValidatorValid] = useState<boolean | null>(null)
  const [rampQuote, setRampQuote] = useState<Record<string, unknown> | null>(null)
  const [rampError, setRampError] = useState<string | null>(null)
  const [cvaPair, setCvaPair] = useState<{ origin?: string; atoken?: string } | null>(null)
  const [cviLoading, setCviLoading] = useState(true)

  useErrorToast(cviError)

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
    abi: clearNotePolicyAbi,
    functionName: 'inspect',
    args: [addresses.clinv01, REF_OFFER_MAKER, buyer, inspectUnits],
  })

  const negativeControl = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.clearNotePolicy,
    abi: clearNotePolicyAbi,
    functionName: 'inspect',
    args: [addresses.clinv01, buyer, getAddress(NO_APASS_SINK), inspectUnits],
  })

  useEffect(() => {
    let cancelled = false
    async function loadCva() {
      setCviLoading(true)
      setCviError(null)
      try {
        const results = await Promise.allSettled([
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

        const errors: string[] = []
        const depRes = results[0].status === 'fulfilled' ? results[0].value : null
        const vNote = results[1].status === 'fulfilled' ? results[1].value : null
        const vCash = results[2].status === 'fulfilled' ? results[2].value : null
        const valReg = results[3].status === 'fulfilled' ? results[3].value : null
        const valVerify = results[4].status === 'fulfilled' ? results[4].value : null
        const ramp = results[5].status === 'fulfilled' ? results[5].value : null

        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            errors.push(`CVI request ${i + 1}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
          }
        })
        if (errors.length > 0) setCviError(errors.join(' · '))

        const tokens = (depRes?.data as {
          tokens?: Array<{
            origin_token?: { address?: string }
            atoken?: { address?: string }
          }>
        } | undefined)?.tokens
        const pair = tokens?.find(
          (t) => t.atoken?.address?.toLowerCase() === addresses.cashToken.toLowerCase(),
        )
        if (pair) {
          setCvaPair({ origin: pair.origin_token?.address, atoken: pair.atoken?.address })
        }

        const noteData = vNote?.data as { code?: number; message?: string } | undefined
        const cashData = vCash?.data as { code?: number; message?: string } | undefined
        setVerifyRows([
          {
            atoken: addresses.clinv01,
            label: 'CLINV01 (RWA note)',
            code: noteData?.code,
            message: noteData?.message ?? (vNote ? undefined : 'Cleanverse verify unavailable'),
            ok: noteData?.code === 4,
          },
          {
            atoken: addresses.cashToken,
            label: 'aUSDC (CVA cash leg)',
            code: cashData?.code,
            message: cashData?.message ?? (vCash ? undefined : 'Cleanverse verify unavailable'),
            ok: cashData?.code === 4,
          },
        ])

        setValidatorReg((valReg?.data as { registered?: boolean } | undefined)?.registered ?? false)
        const valid = (valVerify?.data as { valid?: boolean } | undefined)?.valid
        setValidatorValid(valid ?? false)

        if (ramp?.ok && ramp.data) {
          setRampQuote(ramp.data as Record<string, unknown>)
          setRampError(null)
        } else {
          setRampQuote(null)
          setRampError(ramp ? String(ramp.message ?? ramp.code) : 'Ramp quote unavailable')
        }
      } catch (e) {
        if (!cancelled) {
          setCviError(e instanceof Error ? e.message : 'Failed to load Cleanverse data')
        }
      } finally {
        if (!cancelled) setCviLoading(false)
      }
    }
    loadCva()
    return () => {
      cancelled = true
    }
  }, [buyer])

  const ok = preflight.data?.[0]
  const code = preflight.data?.[1] as string | undefined
  const sel = code?.slice(0, 10)?.toLowerCase()
  const reason = sel ? (REASON_CODES[sel] ?? code) : '…'
  const negOk = negativeControl.data?.[0]
  const negCode = negativeControl.data?.[1] as string | undefined
  const negSel = negCode?.slice(0, 10)?.toLowerCase()
  const negReason = negSel ? (REASON_CODES[negSel] ?? negCode) : '…'
  const bothVerifyOk = verifyRows.length === 2 && verifyRows.every((r) => r.ok)
  const cviComplete = verifyRows.length === 2 && !cviLoading
  const inspectComplete = !preflight.isLoading && preflight.data !== undefined
  const dvpReady = cviComplete && bothVerifyOk && inspectComplete && Boolean(ok)

  return (
    <div className="product-page investor-desk">
      <header className="investor-desk__header">
        <h1 className="product-title">Investor desk</h1>
        <p className="neo-muted">
          DvP secondary market · CVA aUSDC cash leg · CLINV01 note leg · live Cleanverse pre-flight.
        </p>
      </header>

      <InvestorPositions holder={buyer} noteBalance={balanceNote.data} />

      <div className="investor-desk__grid">
        <NeoCard className={`investor-panel ${dvpReady ? 'investor-panel--ok' : 'investor-panel--warn'}`}>
          <h3 className="dvp-section__title">DvP readiness</h3>
          <p className={dvpReady ? 'ok' : 'warn'}>
            {dvpReady
              ? 'Ready to fill offers'
              : !cviComplete
                ? 'Loading Cleanverse verify_apass…'
                : !bothVerifyOk
                  ? 'Blocked — verify_apass must pass for both legs (code 4)'
                  : !inspectComplete
                    ? 'Loading on-chain inspect()…'
                    : 'Blocked — on-chain inspect() must pass for DvP leg'}
          </p>
          <dl className="investor-desk__balances">
            <div>
              <dt>CLINV01</dt>
              <dd>
                {balanceNote.data != null
                  ? formatTokenAmount(balanceNote.data, 18)
                  : '…'}
              </dd>
            </div>
            <div>
              <dt>aUSDC</dt>
              <dd>
                {balanceCash.data != null
                  ? formatTokenAmount(balanceCash.data, 6)
                  : '…'}
              </dd>
            </div>
          </dl>
        </NeoCard>

        <NeoCard className="investor-panel">
          <h3 className="dvp-section__title">Policy inspect (note leg)</h3>
          <p className="neo-muted investor-panel__inspect-lead">
            Simulates DvP fill: <code>{REF_OFFER_MAKER.slice(0, 10)}…</code> → you,{' '}
            {formatTokenAmount(inspectUnits, 18)} CLINV01
          </p>
          <label className="investor-panel__inspect-size">
            Units to inspect
            <input
              className="neo-input"
              type="text"
              inputMode="decimal"
              value={inspectUnitsStr}
              onChange={(e) => setInspectUnitsStr(e.target.value)}
            />
          </label>
          <p>Result: {ok ? 'PASS' : preflight.isLoading ? '…' : 'DENY'}</p>
          <p>
            Selector: <code>{sel ?? 'loading'}</code>
          </p>
          <p className="neo-muted">{reason}</p>
        </NeoCard>
      </div>

      <details className="investor-desk__details">
        <summary>Negative control — no A-Pass sink (must DENY)</summary>
        <NeoCard className="investor-panel investor-panel--warn">
          <p className="neo-muted">
            Transfer to <code>{NO_APASS_SINK}</code> — proves policy blocks recipients without A-Pass.
          </p>
          <p>Result: {negOk ? 'PASS (unexpected)' : negativeControl.isLoading ? '…' : 'DENY ✓'}</p>
          <p>
            Selector: <code>{negSel ?? 'loading'}</code>
          </p>
          <p className="neo-muted">{negReason}</p>
        </NeoCard>
      </details>

      <NeoCard className="investor-panel">
        <h3 className="dvp-section__title">CVI · verify_apass (live)</h3>
        {cviLoading ? (
          <p className="neo-muted">Loading Cleanverse…</p>
        ) : (
          <table className="neo-table">
            <thead>
              <tr>
                <th>Leg</th>
                <th>Result</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {verifyRows.map((r) => (
                <tr key={r.atoken}>
                  <td>{r.label}</td>
                  <td>{r.ok ? 'PASS (4)' : r.code != null ? `DENY (${r.code})` : '…'}</td>
                  <td>{r.message ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {cvaPair && (
          <p className="neo-muted investor-panel__foot">
            CVA: USDC <code>{cvaPair.origin}</code> → aUSDC <code>{cvaPair.atoken}</code>
          </p>
        )}
      </NeoCard>

      <details className="investor-desk__details">
        <summary>Validator pool &amp; fiat ramp</summary>
        <div className="investor-desk__details-grid">
          <NeoCard>
            <h4>CCP validator</h4>
            <p className="neo-muted">
              Pool <code>{addresses.compliancePool}</code>
            </p>
            <p>Registered: {validatorReg === null ? '…' : validatorReg ? 'yes' : 'no'}</p>
            <p>Buyer valid: {validatorValid === null ? '…' : validatorValid ? 'yes' : 'no'}</p>
          </NeoCard>
          <NeoCard>
            <h4>Fiat ramp quote</h4>
            {rampQuote ? (
              <pre className="code-block">{JSON.stringify(rampQuote, null, 2)}</pre>
            ) : (
              <p className="neo-muted">{rampError ?? 'No quote'}</p>
            )}
          </NeoCard>
        </div>
      </details>

      <DvPPostOffer onPosted={() => setOfferRefresh((k) => k + 1)} />
      <DvPOfferBook refreshKey={offerRefresh} />

      <ProductLinks
        items={[
          { href: '/debug/transfers', label: 'Transfer demo' },
          { href: '/debug/minidvp', label: 'MiniDvP' },
        ]}
      />
      <p className="product-links">
        <a href={`${explorerUrl}/address/${addresses.dvpEscrow}`}>DvP on Monadscan</a>
      </p>
    </div>
  )
}

export default function InvestorPage() {
  const { address } = useAccount()

  return (
    <WalletGate
      title="Connect to invest"
      description="Your wallet is checked against Cleanverse A-Pass and on-chain policy before any DvP action."
    >
      {address ? <InvestorDesk buyer={address} /> : null}
    </WalletGate>
  )
}
