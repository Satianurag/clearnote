'use client'

import {
  useAccount,
  useChainId,
  useReadContract,
  useSimulateContract,
  useWriteContract,
} from 'wagmi'
import { parseUnits } from 'viem'
import { addresses, chainId } from '@/lib/config'
import { erc20Abi, miniDvpAbi } from '@/lib/contracts'
import { monadTestnet } from '@/wagmi.config'

const NOTE_AMT = parseUnits('1', 18)
const CASH_AMT = parseUnits('1', 6)

function formatErr(error: Error) {
  const e = error as Error & { shortMessage?: string }
  return e.shortMessage ?? e.message
}

export function MiniDvPForm() {
  const productNote = addresses.clinv01
  const currentChain = useChainId()
  const { address } = useAccount()
  const onMonad = currentChain === chainId

  const noteBal = useReadContract({
    chainId: monadTestnet.id,
    address: productNote,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && onMonad && productNote) },
  })

  const cashBal = useReadContract({
    chainId: monadTestnet.id,
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && onMonad) },
  })

  const approveNote = useSimulateContract({
    chainId: monadTestnet.id,
    address: productNote,
    abi: erc20Abi,
    functionName: 'approve',
    args: productNote ? [addresses.miniDvp, NOTE_AMT] : undefined,
    account: address,
    query: { enabled: Boolean(address && onMonad && productNote) },
  })

  const approveCash = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.usdc,
    abi: erc20Abi,
    functionName: 'approve',
    args: [addresses.miniDvp, CASH_AMT],
    account: address,
    query: { enabled: Boolean(address && onMonad) },
  })

  const settle = useSimulateContract({
    chainId: monadTestnet.id,
    address: addresses.miniDvp,
    abi: miniDvpAbi,
    functionName: 'settle',
    args: productNote
      ? [
          productNote,
          addresses.usdc,
          address ?? '0x0000000000000000000000000000000000000000',
          address ?? '0x0000000000000000000000000000000000000000',
          NOTE_AMT,
          CASH_AMT,
        ]
      : undefined,
    account: address,
    query: { enabled: Boolean(address && onMonad && productNote) },
  })

  const { writeContract, isPending, error: writeError, isSuccess } = useWriteContract()

  if (!productNote) {
    return (
      <p className="warn">
        Set <code>NEXT_PUBLIC_CLINV01</code> (WO-08 product token). MiniDvP must not use CLNOTE02 —
        untouched history token per global constraints.
      </p>
    )
  }

  if (!address) return <p>Connect wallet to use MiniDvP.</p>
  if (!onMonad) return <p className="error">Switch to Monad testnet first.</p>

  const errMsg =
    writeError ? formatErr(writeError) :
    settle.error ? formatErr(settle.error) :
    approveNote.error ? formatErr(approveNote.error) :
    approveCash.error ? formatErr(approveCash.error) :
    null

  return (
    <div>
      <p className="muted">
        Atomic settle: 1 CLINV01 + 1 USDC via MiniDvP at <code>{addresses.miniDvp}</code>.
        Product flows use CLINV01 only (not CLNOTE02).
      </p>
      <p>
        CLINV01 balance: {noteBal.data?.toString() ?? '—'} · USDC balance:{' '}
        {cashBal.data?.toString() ?? '—'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          type="button"
          disabled={!approveNote.data || isPending}
          onClick={() => approveNote.data && writeContract(approveNote.data.request)}
        >
          Approve CLINV01
        </button>
        <button
          type="button"
          disabled={!approveCash.data || isPending}
          onClick={() => approveCash.data && writeContract(approveCash.data.request)}
        >
          Approve USDC
        </button>
        <button
          type="button"
          disabled={!settle.data || isPending}
          onClick={() => settle.data && writeContract(settle.data.request)}
        >
          {isPending ? 'Signing…' : 'Settle (MiniDvP)'}
        </button>
      </div>
      {isSuccess && <p className="ok">Transaction submitted</p>}
      {errMsg && <pre className="error-pre">{errMsg}</pre>}
    </div>
  )
}
