import {
  concatHex,
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { addresses, rpcUrl } from '@/lib/config'
import { getServerSecret } from '@/lib/server-keys'
import { monadTestnet } from '@/wagmi.config'

const ZERO = '0x0000000000000000000000000000000000000000' as const

const safeAbi = [
  {
    name: 'nonce',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'getTransactionHash',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: '_nonce', type: 'uint256' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    name: 'execTransaction',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
      { name: 'operation', type: 'uint8' },
      { name: 'safeTxGas', type: 'uint256' },
      { name: 'baseGas', type: 'uint256' },
      { name: 'gasPrice', type: 'uint256' },
      { name: 'gasToken', type: 'address' },
      { name: 'refundReceiver', type: 'address' },
      { name: 'signatures', type: 'bytes' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

export function getSafeSignerKeys(): { pkA: Hex; pkB2: Hex } | null {
  const pkA = getServerSecret('WALLET_A_PRIVATE_KEY') as Hex | undefined
  const pkB2 = getServerSecret('WALLET_B2_PRIVATE_KEY') as Hex | undefined
  if (!pkA?.startsWith('0x') || !pkB2?.startsWith('0x')) return null
  return { pkA, pkB2 }
}

/** Execute one Safe 2-of-3 tx (owners A + B2) — mirrors scripts/safe-exec.sh */
export async function safeExecuteCalldata(to: Address, data: Hex): Promise<Hex> {
  const keys = getSafeSignerKeys()
  if (!keys) throw new Error('Safe signer keys not configured on server')

  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(rpcUrl) })
  const accountA = privateKeyToAccount(keys.pkA)
  const accountB2 = privateKeyToAccount(keys.pkB2)
  const walletClient = createWalletClient({
    chain: monadTestnet,
    transport: http(rpcUrl),
    account: accountA,
  })

  const safe = addresses.safe
  const nonce = await publicClient.readContract({
    address: safe,
    abi: safeAbi,
    functionName: 'nonce',
  })

  const txHash = await publicClient.readContract({
    address: safe,
    abi: safeAbi,
    functionName: 'getTransactionHash',
    args: [to, BigInt(0), data, 0, BigInt(0), BigInt(0), BigInt(0), ZERO, ZERO, nonce],
  })

  const sigA = await accountA.sign({ hash: txHash })
  const sigB2 = await accountB2.sign({ hash: txHash })
  const combined = concatHex([sigA, sigB2])

  let gasLimit = BigInt(250_000)
  try {
    const est = await publicClient.estimateContractGas({
      address: safe,
      abi: safeAbi,
      functionName: 'execTransaction',
      args: [to, BigInt(0), data, 0, BigInt(0), BigInt(0), BigInt(0), ZERO, ZERO, combined],
      account: accountA,
    })
    gasLimit = (est * BigInt(120)) / BigInt(100) + BigInt(10_000)
  } catch {
    /* fallback */
  }

  const hash = await walletClient.writeContract({
    address: safe,
    abi: safeAbi,
    functionName: 'execTransaction',
    args: [to, BigInt(0), data, 0, BigInt(0), BigInt(0), BigInt(0), ZERO, ZERO, combined],
    gas: gasLimit,
  })

  return hash
}
