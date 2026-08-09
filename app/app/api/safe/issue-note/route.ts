import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Hex } from 'viem'
import { clientIp, guardRateLimit } from '@/lib/api-guard'
import { guardApiPersona } from '@/lib/api-persona'
import { addresses, rpcUrl } from '@/lib/config'
import { clearNoteControllerAbi, invoiceRegistryAbi } from '@/lib/contracts'
import { rateLimit } from '@/lib/rate-limit'
import { siweDomainFromRequest, verifyFinanceSiwe } from '@/lib/siwe'
import { safeExecuteCalldata, getSafeSignerKeys } from '@/lib/safe-exec'
import { monadTestnet } from '@/wagmi.config'

export const dynamic = 'force-dynamic'

const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/
const DEFAULT_UNITS = BigInt('1000000000000000000') // 1e18 — matches seed scripts

export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, 'safe/issue-note', { limit: 20, windowMs: 60_000 })
  if (blocked) return blocked

  const personaBlocked = guardApiPersona(request, { mode: 'roles', roles: ['exporter'] })
  if (personaBlocked) return personaBlocked

  if (!getSafeSignerKeys()) {
    return NextResponse.json(
      { error: 'Safe signer keys not configured (WALLET_A_PRIVATE_KEY, WALLET_B2_PRIVATE_KEY)' },
      { status: 503 },
    )
  }

  let body: {
    invoiceId?: string
    originator?: string
    units?: string
    siweMessage?: string
    siweSignature?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const invoiceId = body.invoiceId?.trim() as Hex | undefined
  const originatorClaim = body.originator?.trim()

  if (!invoiceId || !BYTES32_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'valid invoiceId (bytes32) required' }, { status: 400 })
  }
  if (!originatorClaim || !isAddress(originatorClaim)) {
    return NextResponse.json({ error: 'valid originator address required' }, { status: 400 })
  }

  const siweMessage = body.siweMessage?.trim()
  const siweSignature = body.siweSignature?.trim() as Hex | undefined
  if (!siweMessage || !siweSignature) {
    return NextResponse.json(
      { error: 'SIWE message and signature required — sign in wallet to authorize Safe finance' },
      { status: 401 },
    )
  }

  const domain = siweDomainFromRequest(request.headers.get('host'))
  const siwe = await verifyFinanceSiwe({
    message: siweMessage,
    signature: siweSignature,
    expectedAddress: originatorClaim,
    invoiceId,
    domain,
  })
  if (!siwe.ok) {
    return NextResponse.json({ error: siwe.error }, { status: 401 })
  }

  const ip = clientIp(request)
  const ipLimit = rateLimit(`issue-note:ip:${ip}`, { limit: 20, windowMs: 60_000 })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `rate limit exceeded — retry in ${ipLimit.retryAfterSec}s` },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec) } },
    )
  }

  const invoiceLimit = rateLimit(`issue-note:inv:${invoiceId.toLowerCase()}`, {
    limit: 3,
    windowMs: 300_000,
  })
  if (!invoiceLimit.ok) {
    return NextResponse.json(
      { error: `invoice rate limit — retry in ${invoiceLimit.retryAfterSec}s` },
      { status: 429, headers: { 'Retry-After': String(invoiceLimit.retryAfterSec) } },
    )
  }

  const units = body.units ? BigInt(body.units) : DEFAULT_UNITS
  if (units <= BigInt(0)) {
    return NextResponse.json({ error: 'units must be positive' }, { status: 400 })
  }

  const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })

  const inv = await client.readContract({
    address: addresses.registry,
    abi: invoiceRegistryAbi,
    functionName: 'get',
    args: [invoiceId],
  })

  const status = Number(inv.status)
  if (status === 0) {
    return NextResponse.json({ error: 'invoice not registered' }, { status: 400 })
  }
  if (status !== 2) {
    return NextResponse.json(
      { error: `invoice status ${status} — need ObligorAccepted (2) before finance` },
      { status: 400 },
    )
  }

  const claimedOriginator = getAddress(originatorClaim)
  const onChainOriginator = getAddress(inv.originator)
  if (claimedOriginator !== onChainOriginator) {
    return NextResponse.json(
      { error: 'originator does not match on-chain invoice record' },
      { status: 403 },
    )
  }

  // Notes are always minted to the registered originator — never caller-supplied.
  const to = onChainOriginator
  const data = encodeFunctionData({
    abi: clearNoteControllerAbi,
    functionName: 'issueNote',
    args: [invoiceId, addresses.clinv01, to, units],
  })

  try {
    await client.simulateContract({
      address: addresses.controller,
      abi: clearNoteControllerAbi,
      functionName: 'issueNote',
      args: [invoiceId, addresses.clinv01, to, units],
      account: addresses.safe,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'issueNote simulation failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    const txHash = await safeExecuteCalldata(addresses.controller, data)
    return NextResponse.json({
      ok: true,
      txHash,
      invoiceId,
      recipient: to,
      units: units.toString(),
      noteToken: addresses.clinv01,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Safe execution failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
