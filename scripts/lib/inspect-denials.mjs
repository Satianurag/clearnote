import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const RPC = process.env.MONAD_RPC ?? 'https://testnet-rpc.monad.xyz'
const INSPECT_AMOUNT = '1000000000000000000'

const SCENARIOS = [
  { scenario: 'Ref: issuer', to: '0x20a2A3cBDd040fdC24c4ebA6fE8531Dad068B7CB' },
  { scenario: 'Ref: investor', to: '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b' },
  { scenario: 'Ref: investor B2', to: '0xb77Dabe967e53dFa2A46B040A2269d6E26A5C7F1' },
  { scenario: 'Ref: frozen', to: '0x052eF2f1ce92245E264785ab99A1e7114c809534' },
  { scenario: 'Ref: tier-low', to: '0x10aBc0Efeff51Ce3dDAdd17eD55261163E0dEd05' },
  { scenario: 'Ref: no A-Pass', to: '0xdead000000000000000000000000000000000001' },
  { scenario: 'Ref: sanctioned (SDN)', to: '0x098b716b8aaf21512996dc57eb0615e2383e2f96' },
]

function loadDeploy() {
  return JSON.parse(readFileSync(resolve(root, 'deployments/monad-10143.json'), 'utf8'))
}

function parseInspectOutput(raw) {
  const lines = raw
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length >= 2) {
    const ok = lines[0] === 'true'
    const selector = lines[1].startsWith('0x') ? lines[1].slice(0, 10) : lines[1]
    const reason = lines[2]?.replace(/^"|"$/g, '') ?? ''
    return { ok, selector, reason }
  }
  const line = lines.join(' ')
  const parts = line.match(/^(true|false)\s+(0x[a-fA-F0-9]+)\s+"(.*)"$/)
  if (parts) {
    return { ok: parts[1] === 'true', selector: parts[2].slice(0, 10), reason: parts[3] }
  }
  return { ok: false, selector: 'error', reason: line.slice(0, 200) }
}

/** Live inspect() denial snapshot for audit packs (off-chain; policy hook is STATICCALL). */
export function captureDenialLog() {
  const deploy = loadDeploy()
  const policy = deploy.policy ?? deploy.policyV3_1
  const token = deploy.e2e?.clinv01
  const from = '0x9AE53a6d3c8E8955D1bAA660B4aBd477Fe512C2b'
  const at = new Date().toISOString()
  const log = []

  for (const { scenario, to } of SCENARIOS) {
    try {
      const out = execFileSync(
        'cast',
        [
          'call',
          policy,
          'inspect(address,address,address,uint256)(bool,bytes4,string)',
          token,
          from,
          to,
          INSPECT_AMOUNT,
          '--rpc-url',
          RPC,
        ],
        { encoding: 'utf8', timeout: 15_000 },
      )
      const parsed = parseInspectOutput(out)
      if (!parsed.ok && parsed.selector !== 'error') {
        log.push({
          scenario,
          from,
          to,
          amount: INSPECT_AMOUNT,
          ok: false,
          selector: parsed.selector,
          reason: parsed.reason || parsed.selector,
          at,
        })
      }
    } catch (e) {
      log.push({
        scenario,
        from,
        to,
        amount: INSPECT_AMOUNT,
        ok: false,
        selector: 'error',
        reason: e instanceof Error ? e.message : String(e),
        at,
      })
    }
  }

  return log
}
