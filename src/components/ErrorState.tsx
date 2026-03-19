import { useState } from 'react'
import styles from './ErrorState.module.css'

interface ErrorStateProps {
  message?: string
  detail?: string
  rawDetail?: string
  onRetry?: () => void
}

/**
 * Reusable error display for failed API/data loads.
 * Uses sad1.png from CDN.
 */
export default function ErrorState({
  message = 'Failed to load data',
  detail,
  rawDetail,
  onRetry,
}: ErrorStateProps) {
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div className={styles.container}>
      <img
        src="https://cdn.datdota.com/images/errors/sad1.png"
        alt="Error"
        className={styles.image}
      />
      <h3 className={styles.title}>{message}</h3>
      {detail && <p className={styles.detail}>{detail}</p>}
      <div className={styles.actions}>
        {onRetry && (
          <button className={styles.retry} onClick={onRetry}>
            Try again
          </button>
        )}
        {rawDetail && (
          <button
            className={styles.toggleRaw}
            onClick={() => setShowRaw(!showRaw)}
          >
            {showRaw ? 'Hide details' : 'Show details'}
          </button>
        )}
      </div>
      {rawDetail && showRaw && (
        <pre className={styles.rawDetail}>{rawDetail}</pre>
      )}
    </div>
  )
}
