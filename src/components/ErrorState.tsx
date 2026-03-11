import styles from './ErrorState.module.css'

interface ErrorStateProps {
  message?: string
  detail?: string
  onRetry?: () => void
}

/**
 * Reusable error display for failed API/data loads.
 * Uses sad1.png from CDN.
 */
export default function ErrorState({
  message = 'Failed to load data',
  detail,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={styles.container}>
      <img
        src="https://cdn.datdota.com/images/errors/sad1.png"
        alt="Error"
        className={styles.image}
      />
      <h3 className={styles.title}>{message}</h3>
      {detail && <p className={styles.detail}>{detail}</p>}
      {onRetry && (
        <button className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
