import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, getAddress, http, isAddress } from 'viem'
import { guardRateLimit } from '@/lib/api-guard'
import { addresses, rpcUrl } from '@/lib/config'
import { sanctionsRegistryAbi } from '@/lib/contracts'
import { addressInOfacList, ofacRootMeta, proofForAddress } from '@/lib/ofac'
import { readOnChainSanctionsRoot } from '@/lib/ofac-onchain'
import { monadTestnet } from '@/wagmi.config'

export const dynamic = 'force-dynamic'

const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })

export async function POST(request: NextRequest) {
  const blocked = guardRateLimit(request, 'ofac/verify', { limit: 30, windowMs: 60_000 })
  if (blocked) return blocked

  const body = (await request.json().catch(() => ({}))) as { address?: string }
  const raw = body.address?.trim()
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ error: 'valid address required' }, { status: 400 })
  }

  const who = getAddress(raw)
  const meta = ofacRootMeta()
  if (!meta) {
    return NextResponse.json({ error: 'OFAC root file missing' }, { status: 503 })
  }

  const proof = proofForAddress(who)
  const inSeedList = addressInOfacList(who)

  let merkleVerified = false
  let sanctionedOnChain = false
  let onChainRoot: string | null = null

  try {
    const [verified, sanctioned] = await Promise.all([
      proof
        ? client.readContract({
            address: addresses.sanctions,
            abi: sanctionsRegistryAbi,
            functionName: 'verifyInclusion',
            args: [who, proof],
          })
        : Promise.resolve(false),
      client.readContract({
        address: addresses.sanctions,
        abi: sanctionsRegistryAbi,
        functionName: 'isSanctioned',
        args: [who],
      }),
    ])

    merkleVerified = verified
    sanctionedOnChain = sanctioned
    onChainRoot = await readOnChainSanctionsRoot()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'on-chain read failed' },
      { status: 503 },
    )
  }

  const rootMatches =
    onChainRoot != null && onChainRoot.toLowerCase() === meta.root.toLowerCase()

  return NextResponse.json({
    address: who,
    inSeedList,
    merkleVerified,
    sanctionedOnChain,
    proofAvailable: Boolean(proof),
    seedRoot: meta.root,
    onChainRoot,
    rootMatches,
    sourceDate: meta.sourceDate,
    totalCount: meta.totalCount,
    realCount: meta.realCount,
    demoCount: meta.demoCount,
  })
}
