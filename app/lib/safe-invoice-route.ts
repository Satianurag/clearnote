import { NextRequest, NextResponse } from 'next/server'
import {
  createPublicClient,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  type Hex,
} from 'viem'
import { clientIp } from '@/lib/api-guard'
import { addresses, rpcUrl } from '@/lib/config'
import { clearNoteControllerAbi, invoiceRegistryAbi } from '@/lib/contracts'
import { rateLimit } from '@/lib/rate-limit'
import { siweDomainFromRequest } from '@/lib/siwe'
import { safeExecuteCalldata, getSafeSignerKeys } from '@/lib/safe-exec'
import { monadTestnet } from '@/wagmi.config'

export const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/

type SiweVerifier = (params: {
  message: string
  signature: `0x${string}`
  expectedAddress: string
  invoiceId: string
  domain: string
}) => Promise<{ ok: true } | { ok: false; error: string }>

type SafeInvoiceRouteOpts = {
  rateLimitKey: string
  verifySiwe: SiweVerifier
  requiredStatus: number
  requiredStatusLabel: string
  encodeCalldata: (invoiceId: Hex) => Hex
  simulate: (args: {
    client: ReturnType<typeof createPublicClient>
    invoiceId: Hex
  }) => Promise<void>
}

export async function handleSafeInvoiceRoute(
  request: NextRequest,
  opts: SafeInvoiceRouteOpts,
): Promise<NextResponse> {
  if (!getSafeSignerKeys()) {
    return NextResponse.json(
      { error: 'Safe signer keys not configured (WALLET_A_PRIVATE_KEY, WALLET_B2_PRIVATE_KEY)' },
      { status: 503 },
    )
  }

  let body: {
    invoiceId?: string
    originator?: string
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
      { error: 'SIWE message and signature required — sign in wallet to authorize Safe action' },
      { status: 401 },
    )
  }

  const domain = siweDomainFromRequest(request.headers.get('host'))
  const siwe = await opts.verifySiwe({
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
  const ipLimit = rateLimit(`${opts.rateLimitKey}:ip:${ip}`, { limit: 20, windowMs: 60_000 })
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: `rate limit exceeded — retry in ${ipLimit.retryAfterSec}s` },
      { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSec) } },
    )
  }

  const invoiceLimit = rateLimit(`${opts.rateLimitKey}:inv:${invoiceId.toLowerCase()}`, {
    limit: 3,
    windowMs: 300_000,
  })
  if (!invoiceLimit.ok) {
    return NextResponse.json(
      { error: `invoice rate limit — retry in ${invoiceLimit.retryAfterSec}s` },
      { status: 429, headers: { 'Retry-After': String(invoiceLimit.retryAfterSec) } },
    )
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
  if (status !== opts.requiredStatus) {
    return NextResponse.json(
      {
        error: `invoice status ${status} — need ${opts.requiredStatusLabel} (${opts.requiredStatus})`,
      },
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

  const data = opts.encodeCalldata(invoiceId)

  try {
    await opts.simulate({ client, invoiceId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'simulation failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    const txHash = await safeExecuteCalldata(addresses.controller, data)
    return NextResponse.json({
      ok: true,
      txHash,
      invoiceId,
      noteToken: addresses.clinv01,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Safe execution failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export function settleCalldata(invoiceId: Hex): Hex {
  return encodeFunctionData({
    abi: clearNoteControllerAbi,
    functionName: 'settle',
    args: [invoiceId, addresses.clinv01],
  })
}

export function markDefaultCalldata(invoiceId: Hex): Hex {
  return encodeFunctionData({
    abi: clearNoteControllerAbi,
    functionName: 'markDefault',
    args: [invoiceId],
  })
}
