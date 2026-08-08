'use client'

import {
  useAccount,
  useChainId,
  useSimulateContract,
  useWriteContract,
} from 'wagmi'
import { parseUnits, type Address } from 'viem'
import { addresses, chainId, demoWallets } from '@/lib/config'
import { erc20Abi } from '@/lib/contracts'
import { monadTestnet } from '@/wagmi.config'

const AMOUNT = parseUnits('1', 18)

function formatErr(error: Error) {
  const e = error as Error & { shortMessage?: string }
  return e.shortMessage ?? e.message
}

function decodeHint(msg: string) {
  if (msg.includes('0xa6725971')) return 'Recipient has no A-Pass (Cleanverse compliance)'
  return null
}

function TransferButton({
  label,
  to,
  expectPass,
}: {
  label: string
  to: Address
  expectPass: boolean
}) {
  const currentChain = useChainId()
  const { address } = useAccount()
  const onMonad = currentChain === chainId

  const sim = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.cllat01,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, AMOUNT],
    account: address,
    query: { enabled: Boolean(address && onMonad), retry: false },
  })

  const { writeContract, isPending, error: writeError, isSuccess: writeOk } = useWriteContract()
  const simMsg = sim.isError ? formatErr(sim.error) : ''
  const writeMsg = writeError ? formatErr(writeError) : ''
  const errMsg = writeMsg || simMsg
  const hint = errMsg ? decodeHint(errMsg) : null
  const canSend = Boolean(sim.data && onMonad && !isPending)

  return (
    <div className="card">
      <strong>{label}</strong>
      <p className="muted">to: {to}</p>
      <button type="button" disabled={!canSend} onClick={() => sim.data && writeContract(sim.data.request)}>
        {isPending ? 'Signing…' : 'Send 1 CLLAT'}
      </button>
      {sim.isSuccess && !writeError && !writeOk && <p className="ok">Pre-flight OK — safe to sign</p>}
      {writeOk && <p className="ok">Transaction submitted</p>}
      {errMsg && (
        <pre className="error-pre">
          {errMsg}
          {hint && <div className="hint">{hint}</div>}
        </pre>
      )}
      {expectPass && sim.isError && (
        <p className="muted">Expected pass — connect wallet B on Monad testnet.</p>
      )}
    </div>
  )
}

export function TransferTest() {
  return (
    <div>
      <TransferButton label="Should pass — send to wallet A" to={demoWallets.a} expectPass />
      <TransferButton
        label="Should fail — no A-Pass recipient"
        to={demoWallets.dead}
        expectPass={false}
      />
    </div>
  )
}
