import styles from './Home.module.css'

export default function Home() {
  return (
    <div className={styles.home}>
      <h1>datdota</h1>
      <p className={styles.tagline}>
        Professional Dota 2 match statistics
      </p>
    </div>
  )
}
