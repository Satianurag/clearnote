import { createPublicClient, http, parseUnits, getAddress } from 'viem'

const RPC = 'https://testnet-rpc.monad.xyz'
const CLLAT = '0x13aDF50039Db284B380f06FD4be0061C30A92c96'
const B = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
const A = '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'
const DEAD = getAddress('0xdead000000000000000000000000000000000001')

const ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
]

const client = createPublicClient({ transport: http(RPC) })

async function sim(label, from, to) {
  try {
    await client.simulateContract({
      address: CLLAT,
      abi: ABI,
      functionName: 'transfer',
      args: [to, parseUnits('1', 18)],
      account: from,
    })
    console.log(`${label}: OK`)
  } catch (e) {
    const err = e
    console.log(`${label}: FAIL`)
    console.log('shortMessage:', err.shortMessage)
    console.log('message:', err.message?.slice(0, 500))
    const raw = err.cause?.cause?.data || err.cause?.data || err.data
    console.log('raw data:', raw)
    const blob = JSON.stringify(err, (_, v) => (typeof v === 'bigint' ? v.toString() : v))
    const sel = blob.match(/0xa6725971/)
    console.log('contains 0xa6725971:', !!sel)
  }
}

await sim('B->A (should pass)', B, A)
await sim('B->DEAD (should fail)', B, DEAD)
