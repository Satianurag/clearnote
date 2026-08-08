import { ApassLookup } from '@/components/ApassLookup'

export default function CompliancePage() {
  return (
    <div>
      <h2>A-Pass lookup</h2>
      <p className="muted">Cleanverse CVI — verify wallet eligibility on Monad sandbox.</p>
      <ApassLookup />
    </div>
  )
}
