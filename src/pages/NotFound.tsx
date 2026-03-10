import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div style={{ textAlign: 'center', marginTop: '10vh' }}>
      <h1>404</h1>
      <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-md)' }}>
        Page not found
      </p>
      <Link to="/" style={{ marginTop: 'var(--space-lg)', display: 'inline-block' }}>
        Back to home
      </Link>
    </div>
  )
}
