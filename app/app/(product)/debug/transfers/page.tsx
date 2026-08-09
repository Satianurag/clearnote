import { TransferTest } from '@/components/TransferTest'
import { WalletBanner } from '@/components/WalletBanner'
import { WalletGate } from '@/components/WalletGate'

export default function DebugTransfersPage() {
  return (
    <WalletGate
      title="Connect to transfer"
      description="Sign a real CLLAT01 transfer from your wallet. Pre-flight simulation shows revert reason before you sign."
    >
      <div>
        <p className="muted debug-page__note">
          Developer debug surface — not linked from main navigation.
        </p>
        <h2>Wallet transfer</h2>
        <p className="muted">
          Compliance pre-flight on CLLAT01 — pass to a known address, fail to no-A-Pass sink.
        </p>
        <WalletBanner />
        <TransferTest />
      </div>
    </WalletGate>
  )
}
