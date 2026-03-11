import { Outlet } from 'react-router-dom'
import Navigation from './Navigation'
import Footer from './Footer'
import styles from './PageShell.module.css'

export default function PageShell() {
  return (
    <div className={styles.shell}>
      <Navigation />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
