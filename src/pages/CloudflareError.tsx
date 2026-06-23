import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PageMeta from '../components/PageMeta'
import styles from './NotFound.module.css'

type ErrorKey = 'cf500' | 'cfattack' | 'cfwidget' | 'cfwafblock' | 'cfinteractivechallenge' | 'cfipblock'

interface CfError {
  errorType: ErrorKey
  image: string
  title: string
  message: ReactNode
  description: string
}

const DiscordNote = () => (
  <>
    If you believe this is a mistake, please contact us on{' '}
    <a href="https://discord.gg/datdota" style={{ color: 'var(--color-accent-bright)' }}>Discord</a>.
  </>
)

const ERRORS: Record<ErrorKey, CfError> = {
  cf500: {
    errorType: 'cf500',
    image: 'https://cdn.datdota.com/images/errors/sad1.png',
    title: 'Internal Server Error',
    description: 'Something went wrong on our end. Please try again later.',
    message: 'Something went wrong on our end. Please try again later.',
  },
  cfattack: {
    errorType: 'cfattack',
    image: 'https://cdn.datdota.com/images/errors/sad3.png',
    title: 'Access Denied',
    description: 'Your request was blocked. Contact us on Discord if you believe this is a mistake.',
    message: <>Your request was blocked. <DiscordNote /></>,
  },
  cfwidget: {
    errorType: 'cf500',
    image: 'https://cdn.datdota.com/images/errors/sad2.png',
    title: 'Service Unavailable',
    description: 'This service is temporarily unavailable. Please try again later.',
    message: 'This service is temporarily unavailable. Please try again later.',
  },
  cfwafblock: {
    errorType: 'cfwafblock',
    image: 'https://cdn.datdota.com/images/errors/sad3.png',
    title: 'Request Blocked',
    description: 'Your request was blocked by our security rules.',
    message: <>Your request was blocked by our web application firewall. <DiscordNote /></>,
  },
  cfinteractivechallenge: {
    errorType: 'cfinteractivechallenge',
    image: 'https://cdn.datdota.com/images/errors/sad2.png',
    title: 'Verifying You Are Human',
    description: 'Please complete the challenge below to continue.',
    message: 'Please complete the challenge below to continue.',
  },
  cfipblock: {
    errorType: 'cfipblock',
    image: 'https://cdn.datdota.com/images/errors/sad3.png',
    title: 'Access Restricted',
    description: 'Access from your location or network is restricted.',
    message: <>Access from your location or network is restricted. <DiscordNote /></>,
  },
}

export function Cf500() { return <ErrorPage {...ERRORS.cf500} /> }
export function CfAttack() { return <ErrorPage {...ERRORS.cfattack} /> }
export function CfWidget() { return <ErrorPage {...ERRORS.cfwidget} /> }
export function CfWafBlock() { return <ErrorPage {...ERRORS.cfwafblock} /> }
export function CfInteractiveChallenge() { return <ErrorPage {...ERRORS.cfinteractivechallenge} /> }
export function CfIpBlock() { return <ErrorPage {...ERRORS.cfipblock} /> }

function ErrorPage({ image, title, message, description, errorType }: CfError) {
  return (
    <div className={styles.container}>
      <PageMeta title={title} description={description} noindex />
      <meta name="x-error-type" content={errorType} />
      <Link to="/" style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: '1.5rem',
        color: 'var(--color-primary)',
        textDecoration: 'none',
        letterSpacing: '-0.5px',
        marginBottom: 'var(--space-xl)',
      }}>datdota</Link>
      <img src={image} alt={title} className={styles.image} />
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      <div style={{
        marginTop: '2rem',
        padding: '12px 16px',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: 'var(--color-text-muted)',
        textAlign: 'left',
        maxWidth: 480,
        width: '100%',
      }}>
        <div><span style={{ display: 'inline-block', width: 70 }}>IP</span><span style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>::CLIENT_IP::</span></div>
        <div style={{ marginTop: 4 }}><span style={{ display: 'inline-block', width: 70 }}>Ray ID</span><span style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>::RAY_ID::</span></div>
        <div style={{ marginTop: 4 }}><span style={{ display: 'inline-block', width: 70 }}>Region</span><span style={{ color: 'var(--color-text)', wordBreak: 'break-all' }}>::GEO::</span></div>
      </div>
    </div>
  )
}
