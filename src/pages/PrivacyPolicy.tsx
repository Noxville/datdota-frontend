import styles from './Terms.module.css'

export default function PrivacyPolicy() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Privacy Policy</h1>
      <p className={styles.text}>
        <em>Effective date: 20 March 2026 &mdash; Last updated: 20 March 2026</em>
      </p>

      <section className={styles.section}>
        <h2 className={styles.heading}>1. Controller</h2>
        <p className={styles.text}>
          The data controller for datdota.com (&ldquo;datdota&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;) is Bernard Steenhuisen. You can contact us at{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>2. What Data We Collect</h2>
        <p className={styles.text}>
          datdota is a publicly accessible statistics website for the video game Dota&nbsp;2.
          We collect the minimum amount of personal data necessary to operate the service:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Server access logs</strong> &mdash; your IP address, browser user-agent string,
            requested URL, and timestamp. These are retained for up to 90 days for security and
            abuse-prevention purposes.
          </li>
          <li>
            <strong>Consent record</strong> &mdash; a flag stored in your browser&rsquo;s
            localStorage indicating that you have accepted the Terms of Service and acknowledged
            this Privacy Policy. No personal data is transmitted to our servers for this purpose.
          </li>
          <li>
            <strong>Cloudflare analytics</strong> &mdash; we use Cloudflare, which may collect
            anonymised, aggregated analytics data (page views, country of origin, browser type).
            Cloudflare acts as a data processor on our behalf. See{' '}
            <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
              Cloudflare&rsquo;s Privacy Policy
            </a>.
          </li>
        </ul>
        <p className={styles.text}>
          We do <strong>not</strong> use cookies for tracking, advertising, or analytics.
          We do <strong>not</strong> collect email addresses, names, or account information
          unless you contact us directly.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>3. Dota&nbsp;2 Match Data</h2>
        <p className={styles.text}>
          datdota processes publicly available Dota&nbsp;2 match data provided by Valve Corporation
          through their public APIs and replay files. This data includes player Steam IDs,
          in-game nicknames, and match statistics. This information is already publicly available
          and is processed under the legitimate interest legal basis (Art.&nbsp;6(1)(f) GDPR) for
          the purpose of providing esports statistics to the community.
        </p>
        <p className={styles.text}>
          If you are a professional or semi-professional Dota&nbsp;2 player and wish to exercise
          your data subject rights regarding your match data, please contact us at{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>4. Legal Basis for Processing</h2>
        <p className={styles.text}>
          We process personal data under the following legal bases as defined by the General Data
          Protection Regulation (GDPR):
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Legitimate interest</strong> (Art.&nbsp;6(1)(f)) &mdash; server access logs for
            security and abuse prevention; processing of publicly available Dota&nbsp;2 match data
            for esports statistics.
          </li>
          <li>
            <strong>Contract performance</strong> (Art.&nbsp;6(1)(b)) &mdash; processing necessary
            to provide the service in accordance with the Terms of Service.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>5. Data Retention</h2>
        <ul className={styles.list}>
          <li>Server access logs: up to 90 days</li>
          <li>Dota&nbsp;2 match data: retained indefinitely as part of the historical statistics archive</li>
          <li>Consent records: stored in your browser until you clear localStorage</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>6. Data Sharing &amp; Transfers</h2>
        <p className={styles.text}>
          We do not sell or share personal data with third parties for marketing purposes. Data may
          be processed by the following categories of service providers:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Cloudflare, Inc.</strong> (CDN, DDoS protection, DNS) &mdash; data may be
            transferred to and processed in the United States under Cloudflare&rsquo;s Data
            Processing Addendum and Standard Contractual Clauses.
          </li>
          <li>
            <strong>Hosting provider</strong> &mdash; our servers are located in the European Union.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>7. Your Rights (GDPR)</h2>
        <p className={styles.text}>
          If you are located in the European Economic Area, you have the following rights under
          the GDPR:
        </p>
        <ul className={styles.list}>
          <li><strong>Access</strong> &mdash; request a copy of personal data we hold about you</li>
          <li><strong>Rectification</strong> &mdash; request correction of inaccurate data</li>
          <li><strong>Erasure</strong> &mdash; request deletion of your personal data</li>
          <li><strong>Restriction</strong> &mdash; request that we limit processing of your data</li>
          <li><strong>Portability</strong> &mdash; receive your data in a structured, machine-readable format</li>
          <li><strong>Objection</strong> &mdash; object to processing based on legitimate interest</li>
        </ul>
        <p className={styles.text}>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>. We will respond within
          30 days. You also have the right to lodge a complaint with your local data protection
          authority.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>8. Children</h2>
        <p className={styles.text}>
          datdota is not directed at children under the age of 16. We do not knowingly collect
          personal data from children. If you believe we have inadvertently collected data from a
          child, please contact us so we can delete it.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>9. Changes to This Policy</h2>
        <p className={styles.text}>
          We may update this Privacy Policy from time to time. Material changes will be indicated
          by updating the &ldquo;Last updated&rdquo; date at the top of this page. Continued use
          of the site after changes constitutes acknowledgement of the updated policy.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>10. Contact</h2>
        <p className={styles.text}>
          For any privacy-related questions or requests, contact:{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>
        </p>
      </section>
    </div>
  )
}
