import { MiniDvPForm } from '@/components/MiniDvPForm'
import { WalletBanner } from '@/components/WalletBanner'
import { WalletGate } from '@/components/WalletGate'

export default function DebugMiniDvPPage() {
  return (
    <WalletGate
      title="Connect for MiniDvP"
      description="Atomic note + aUSDC settlement requires your wallet on Monad testnet."
    >
      <div>
        <p className="muted debug-page__note">
          Developer debug surface — not linked from main navigation.
        </p>
        <h2>MiniDvP</h2>
        <p className="muted">Atomic delivery-vs-payment — note leg + cash leg in one transaction.</p>
        <WalletBanner />
        <MiniDvPForm />
      </div>
    </WalletGate>
  )
}
