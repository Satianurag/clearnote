import { MiniDvPForm } from '@/components/MiniDvPForm'
import { WalletBanner } from '@/components/WalletBanner'

export default function MiniDvPPage() {
  return (
    <div>
      <h2>MiniDvP</h2>
      <p className="muted">Atomic delivery-vs-payment — note leg + cash leg in one transaction.</p>
      <WalletBanner />
      <MiniDvPForm />
    </div>
  )
}
