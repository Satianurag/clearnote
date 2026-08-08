import { getAddress, type Address } from 'viem'

function addr(value: string | undefined, defaultAddress: string): Address {
  const v = value?.trim() || defaultAddress
  return getAddress(v)
}

function optionalAddr(value: string | undefined): Address | undefined {
  if (!value?.trim()) return undefined
  return getAddress(value.trim())
}

/** Locked per CLEARNOTE_CONSTRAINTS.md */
export const BASE_ROUTER = addr(
  process.env.NEXT_PUBLIC_CLEANVERSE_ROUTER,
  '0x36489be45fa84f70a0c2bdb11d824be608cb12dd',
)

export const chainId = Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID ?? '10143')

export const addresses = {
  /** WO-08 product token — set NEXT_PUBLIC_CLINV01 after launch */
  clinv01: optionalAddr(process.env.NEXT_PUBLIC_CLINV01) ?? addr(
    process.env.NEXT_PUBLIC_CLINV01,
    '0xEae6ef4f62B735789bD0d899f5f6f2993488Fe69',
  ),
  /** Footage / reason-code demos only — roll back setPolicy to BASE after tests */
  cllat01: addr(process.env.NEXT_PUBLIC_CLLAT01, '0x13aDF50039Db284B380f06FD4be0061C30A92c96'),
  /** Untouched history — NEVER setPolicy, indexer history depends on it */
  clnote02: addr(process.env.NEXT_PUBLIC_CLNOTE02, '0xDAA42E5c1A8B9724F499729609f166B0D140Ec18'),
  /** Origin (native) USDC on Monad — ungated ERC20 */
  originUsdc: addr(process.env.NEXT_PUBLIC_ORIGIN_USDC, '0x534b2f3A21130d7a60830c2Df862319e593943A3'),
  /** Cleanverse CVA cash leg — aUSDC (A-Token, BASE-gated). From query_deposit_atoken_list monad. */
  ausdc: addr(process.env.NEXT_PUBLIC_AUSDC, '0xaC0893567D43C3E7e6e35a72803df05416C1f20D'),
  accessCore: addr(process.env.NEXT_PUBLIC_ACCESS_CORE, '0x8F118338a1fa41E7Fa86Be19A4e8B99Ed58A6EcC'),
  /** DvP / settlement cash token — defaults to CVA aUSDC */
  cashToken: addr(
    process.env.NEXT_PUBLIC_CASH_TOKEN ?? process.env.NEXT_PUBLIC_AUSDC,
    '0xaC0893567D43C3E7e6e35a72803df05416C1f20D',
  ),
  /** @deprecated use originUsdc or cashToken (aUSDC) */
  usdc: addr(process.env.NEXT_PUBLIC_USDC, '0x534b2f3A21130d7a60830c2Df862319e593943A3'),
  miniDvp: addr(process.env.NEXT_PUBLIC_MINI_DVP, '0x0c59e64a3c845A30ba31883115a5e08F56B10fB7'),
  cleanverseRouter: BASE_ROUTER,
  clearNotePolicy: addr(
    process.env.NEXT_PUBLIC_CLEARNOTE_POLICY,
    '0xa36F46f2631bc092E319d7Ab4cCAA97b9cD63890',
  ),
  registry: addr(process.env.NEXT_PUBLIC_REGISTRY, '0x8A515D80279eEfa9f3eC76568257b1f1eF76d534'),
  controller: addr(process.env.NEXT_PUBLIC_CONTROLLER, '0xfE622a9EAEdf047a2379Eb9C7436B8dc2E1D1bAA'),
  dvpEscrow: addr(process.env.NEXT_PUBLIC_DVPE, '0x1860b3182CAd1813Ce0F992E446e87Fb0FD93417'),
  /** @deprecated use dvpEscrow — kept for older env snippets */
  dvpeScrow: addr(process.env.NEXT_PUBLIC_DVPE, '0x1860b3182CAd1813Ce0F992E446e87Fb0FD93417'),
  auditAnchor: addr(process.env.NEXT_PUBLIC_AUDIT_ANCHOR, '0x93806a81533790e4e1736C227C7eA5aBc6D4cc7F'),
  sanctions: addr(process.env.NEXT_PUBLIC_SANCTIONS, '0xF7E706B7956546F213aB9B0DcFD13d1a731B6612'),
  safe: addr(process.env.NEXT_PUBLIC_SAFE, '0xb544d5efb15fbae3b3ad4b1ec3594ffeb0926593'),
  /** Cleanverse IAPassComplianceValidator (Monad UAT) — Telegram pinned CCP guide */
  cleanverseValidator: addr(
    process.env.NEXT_PUBLIC_CLEANVERSE_VALIDATOR,
    '0xaC7e5179C2C7f03f209136886c172eb34F161792',
  ),
  /** Ownable pool registered via POST /validator/register (not DvPEscrow — Safe has no owner()) */
  compliancePool: addr(
    process.env.NEXT_PUBLIC_COMPLIANCE_POOL,
    '0x8eC6b0CcC52aBf6dB6f71844eD468f20EA427748',
  ),
}

export const demoWallets = {
  a: addr(process.env.NEXT_PUBLIC_WALLET_A, '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB'),
  b: addr(process.env.NEXT_PUBLIC_WALLET_B, '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'),
  b2: addr(process.env.NEXT_PUBLIC_WALLET_B2, '0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1'),
  c: addr(process.env.NEXT_PUBLIC_WALLET_C, '0x052eF2f1ce92245E264785ab99A1e7114c809534'),
  d: addr(process.env.NEXT_PUBLIC_WALLET_D, '0xf652F0ACBa57B29461Cc9a9Ecd87b8cf1c51DaB7'),
  e: addr(process.env.NEXT_PUBLIC_WALLET_E, '0x10aBc0Efeff51Ce3dDAdd17eD55261163E0dEd05'),
  dead: addr(process.env.NEXT_PUBLIC_DEAD_ADDR, '0xdead000000000000000000000000000000000001'),
}

export const rpcUrl =
  process.env.NEXT_PUBLIC_MONAD_RPC?.trim() || 'https://testnet-rpc.monad.xyz'

export const explorerUrl = 'https://testnet.monadscan.com'
