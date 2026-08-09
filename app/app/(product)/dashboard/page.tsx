import Link from 'next/link'
import { addresses, chainId } from '@/lib/config'

export default function DashboardPage() {
  return (
    <div>
      <h2>Dashboard</h2>
      <p>Production demo surfaces for ClearNote hackathon build.</p>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Exporter</h3>
          <p className="muted">Upload invoice, register on-chain, originator portfolio.</p>
          <Link href="/exporter">Open exporter →</Link>
        </div>
        <div className="card">
          <h3>Investor</h3>
          <p className="muted">DvP offers, pre-flight inspect(), aUSDC cash leg.</p>
          <Link href="/investor">Open investor →</Link>
        </div>
        <div className="card">
          <h3>Wallet transfer</h3>
          <p className="muted">MetaMask pre-flight — pass to A, fail without A-Pass.</p>
          <Link href="/transfers">Open transfer test →</Link>
        </div>
        <div className="card">
          <h3>Indexed activity</h3>
          <p className="muted">CLNOTE02 transfers via Envio GraphQL (local indexer).</p>
          <Link href="/activity">View activity →</Link>
        </div>
        <div className="card">
          <h3>MiniDvP</h3>
          <p className="muted">Atomic note + aUSDC (CVA) settle on MiniDvP contract.</p>
          <Link href="/minidvp">Open MiniDvP →</Link>
        </div>
        <div className="card">
          <h3>Compliance matrix</h3>
          <p className="muted">Live reason-code matrix from on-chain inspect().</p>
          <Link href="/compliance/matrix">Open matrix →</Link>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3>Deployed contracts</h3>
        <ul className="muted" style={{ fontSize: 13 }}>
          <li>Chain ID: {chainId}</li>
          <li>CLINV01: <code>{addresses.clinv01}</code></li>
          <li>CLNOTE02: <code>{addresses.clnote02}</code></li>
          <li>CLLAT01: <code>{addresses.cllat01}</code></li>
          <li>Origin USDC: <code>{addresses.originUsdc}</code></li>
          <li>aUSDC (CVA cash): <code>{addresses.ausdc}</code></li>
          <li>MiniDvP: <code>{addresses.miniDvp}</code></li>
          <li>ClearNotePolicy: <code>{addresses.clearNotePolicy}</code></li>
          <li>Safe 2-of-3: <code>{addresses.safe}</code></li>
        </ul>
      </div>
    </div>
  )
}
