import { TransferTest } from '@/components/TransferTest'
import { WalletBanner } from '@/components/WalletBanner'

export default function TransfersPage() {
  return (
    <div>
      <h2>Wallet transfer test</h2>
      <p className="muted">
        Connect wallet B (investor). Pre-flight simulation shows revert reason before signing.
        Token: CLLAT01 spare demo token.
      </p>
      <WalletBanner />
      <TransferTest />
    </div>
  )
}
