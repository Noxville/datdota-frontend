import styles from './NotFound.module.css'

const ERRORS = {
  cf500: {
    image: 'https://cdn.datdota.com/images/errors/sad1.png',
    title: 'Internal Server Error',
    message: 'Something went wrong on our end. Please try again later.',
  },
  cfattack: {
    image: 'https://cdn.datdota.com/images/errors/sad3.png',
    title: 'Access Denied',
    message: 'Your request was blocked. If you believe this is a mistake, please contact us on Discord.',
  },
  cfwidget: {
    image: 'https://cdn.datdota.com/images/errors/sad2.png',
    title: 'Service Unavailable',
    message: 'This service is temporarily unavailable. Please try again later.',
  },
} as const

export function Cf500() {
  const e = ERRORS.cf500
  return <ErrorPage image={e.image} title={e.title} message={e.message} />
}

export function CfAttack() {
  const e = ERRORS.cfattack
  return <ErrorPage image={e.image} title={e.title} message={e.message} />
}

export function CfWidget() {
  const e = ERRORS.cfwidget
  return <ErrorPage image={e.image} title={e.title} message={e.message} />
}

function ErrorPage({ image, title, message }: { image: string; title: string; message: string }) {
  return (
    <div className={styles.container}>
      <img src={image} alt={title} className={styles.image} />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
    </div>
  )
}
