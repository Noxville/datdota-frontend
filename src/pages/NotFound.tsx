import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import styles from './NotFound.module.css'

export default function NotFound() {
  return (
    <div className={styles.container}>
      <PageMeta title="Page Not Found" description="The page you're looking for doesn't exist or has been moved." noindex />
      <img
        src="https://cdn.datdota.com/images/errors/sad2.png"
        alt="Not Found"
        className={styles.image}
      />
      <h2 className={styles.title}>Page Not Found</h2>
      <p className={styles.message}>
        The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
      </p>
      <Link to="/" className={styles.homeLink}>
        Back to home
      </Link>
    </div>
  )
}
