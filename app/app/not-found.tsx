import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="app-shell-error">
      <h1>Page not found</h1>
      <p className="neo-muted">This route does not exist in ClearNote.</p>
      <p>
        <Link href="/" className="neo-btn neo-btn--primary">
          Home
        </Link>
        {' · '}
        <Link href="/dashboard">Dashboard</Link>
      </p>
    </div>
  )
}
