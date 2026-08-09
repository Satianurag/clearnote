'use client'

import { useAccount, useChainId, useSimulateContract } from 'wagmi'
import { parseUnits, type Address } from 'viem'
import { NeoButton } from '@/components/neo/NeoButton'
import { TxFeedback } from '@/components/TxFeedback'
import { useContractTx } from '@/hooks/useContractTx'
import { useErrorToast, useSuccessToast } from '@/hooks/useErrorToast'
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
  const tx = useContractTx()

  const sim = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.cllat01,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [to, AMOUNT],
    account: address,
    query: { enabled: Boolean(address && onMonad), retry: false },
  })

  const simMsg = sim.isError ? formatErr(sim.error) : ''
  const hint = simMsg ? decodeHint(simMsg) : null
  const simToastErr =
    simMsg && tx.phase === 'idle' ? (hint ? `${simMsg} — ${hint}` : simMsg) : null
  const successMsg = tx.isSuccess ? 'Transfer confirmed on-chain' : null

  useErrorToast(simToastErr)
  useSuccessToast(successMsg)

  const canSend = Boolean(sim.data && onMonad && !tx.isBusy)

  const buttonLabel = tx.isSigning
    ? 'Confirm in wallet…'
    : tx.isConfirming
      ? 'Sending…'
      : 'Send 1 CLLAT'

  return (
    <div className="card">
      <strong>{label}</strong>
      <p className="muted">to: {to}</p>
      <NeoButton
        variant="secondary"
        disabled={!canSend}
        onClick={() => {
          tx.reset()
          if (sim.data) tx.writeContract(sim.data.request)
        }}
      >
        {buttonLabel}
      </NeoButton>
      {sim.isSuccess && tx.phase === 'idle' && !tx.error && (
        <p className="ok">Pre-flight OK — safe to sign</p>
      )}
      <TxFeedback error={tx.error} onDismiss={() => tx.reset()} />
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
