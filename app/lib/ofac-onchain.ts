import { createPublicClient, http } from 'viem'
import { addresses, rpcUrl } from '@/lib/config'
import { sanctionsRegistryAbi } from '@/lib/contracts'
import { ofacRootMeta } from '@/lib/ofac'
import { monadTestnet } from '@/wagmi.config'

const client = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })

export async function readOnChainSanctionsRoot(): Promise<string | null> {
  const rootCount = await client.readContract({
    address: addresses.sanctions,
    abi: sanctionsRegistryAbi,
    functionName: 'rootCount',
  })
  if (rootCount <= BigInt(0)) return null
  const [root] = await client.readContract({
    address: addresses.sanctions,
    abi: sanctionsRegistryAbi,
    functionName: 'rootAt',
    args: [rootCount - BigInt(1)],
  })
  return root
}

export async function checkOfacRootAlignment(): Promise<{
  ok: boolean
  seedRoot: string | null
  onChainRoot: string | null
  rootMatches: boolean
  sourceDate: string | null
  error?: string
}> {
  const meta = ofacRootMeta()
  if (!meta) {
    return {
      ok: false,
      seedRoot: null,
      onChainRoot: null,
      rootMatches: false,
      sourceDate: null,
      error: 'seed/ofac/ofac-root.json missing',
    }
  }

  try {
    const onChainRoot = await readOnChainSanctionsRoot()
    const rootMatches =
      onChainRoot != null && onChainRoot.toLowerCase() === meta.root.toLowerCase()
    return {
      ok: rootMatches,
      seedRoot: meta.root,
      onChainRoot,
      rootMatches,
      sourceDate: meta.sourceDate,
    }
  } catch (e) {
    return {
      ok: false,
      seedRoot: meta.root,
      onChainRoot: null,
      rootMatches: false,
      sourceDate: meta.sourceDate,
      error: e instanceof Error ? e.message : 'on-chain read failed',
    }
  }
}
