'use client'

import type { Hex } from 'viem'
import { SettlementPanel } from '@/components/SettlementPanel'
import {
  InvoiceSettlementActions,
} from '@/components/InvoiceSettlementActions'
import {
  RaiseDisputeAction,
  usePrimaryHolderBalance,
} from '@/components/RaiseDisputeAction'

type Props = {
  invoiceId: Hex
  status: number
  originator: `0x${string}`
  obligor: `0x${string}`
  faceValue: bigint
  dueDate: bigint
  currency: Hex | string
  onComplete?: () => void
}

export function InvoiceSettlementBlock({
  invoiceId,
  status,
  originator,
  obligor,
  faceValue,
  dueDate,
  currency,
  onComplete,
}: Props) {
  const primaryBalance = usePrimaryHolderBalance(invoiceId, status === 3)

  return (
    <>
      <SettlementPanel
        invoiceId={invoiceId}
        status={status}
        faceValue={faceValue}
        dueDate={dueDate}
        currency={currency}
        obligor={obligor}
      />
      {status === 3 && (
        <InvoiceSettlementActions
          invoiceId={invoiceId}
          originator={originator}
          obligor={obligor}
          status={status}
          dueDate={dueDate}
          primaryHolderBalance={primaryBalance}
          onComplete={onComplete}
        />
      )}
      <RaiseDisputeAction
        invoiceId={invoiceId}
        originator={originator}
        obligor={obligor}
        status={status}
        onComplete={onComplete}
      />
    </>
  )
}
