import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom'
import styles from './NotFound.module.css'

export default function RouteError() {
  const error = useRouteError()

  let title = 'Something went wrong'
  let message = 'An unexpected error occurred. Try refreshing the page.'
  let detail: string | null = null

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page Not Found'
      message = "The page you\u2019re looking for doesn\u2019t exist or has been moved."
    } else {
      title = `Error ${error.status}`
      message = error.statusText || message
    }
  } else if (error instanceof Error) {
    message = error.message
    detail = error.stack?.split('\n').slice(0, 3).join('\n') ?? null
  }

  return (
    <div className={styles.container}>
      <img
        src="https://cdn.datdota.com/images/errors/sad1.png"
        alt="Error"
        className={styles.image}
      />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {detail && (
        <pre className={styles.detail}>{detail}</pre>
      )}
      <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
        <button
          onClick={() => window.location.reload()}
          className={styles.homeLink}
          style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit' }}
        >
          Refresh page
        </button>
        <Link to="/" className={styles.homeLink}>
          Back to home
        </Link>
      </div>
    </div>
  )
}
