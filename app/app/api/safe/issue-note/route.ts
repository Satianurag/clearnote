import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, encodeFunctionData, getAddress, http, isAddress, type Hex } from 'viem'
import { addresses, rpcUrl } from '@/lib/config'
import { clearNoteControllerAbi, invoiceRegistryAbi } from '@/lib/contracts'
import { safeExecuteCalldata, getSafeSignerKeys } from '@/lib/safe-exec'
import { monadTestnet } from '@/wagmi.config'

export const dynamic = 'force-dynamic'

const BYTES32_RE = /^0x[a-fA-F0-9]{64}$/
const DEFAULT_UNITS = BigInt('1000000000000000000') // 1e18 — matches seed scripts

export async function POST(request: NextRequest) {
  if (!getSafeSignerKeys()) {
    return NextResponse.json(
      { error: 'Safe signer keys not configured (WALLET_A_PRIVATE_KEY, WALLET_B2_PRIVATE_KEY)' },
      { status: 503 },
    )
  }

  let body: { invoiceId?: string; recipient?: string; units?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const invoiceId = body.invoiceId?.trim() as Hex | undefined
  const recipient = body.recipient?.trim()

  if (!invoiceId || !BYTES32_RE.test(invoiceId)) {
    return NextResponse.json({ error: 'valid invoiceId (bytes32) required' }, { status: 400 })
  }
  if (!recipient || !isAddress(recipient)) {
    return NextResponse.json({ error: 'valid recipient address required' }, { status: 400 })
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

  const to = getAddress(recipient)
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
