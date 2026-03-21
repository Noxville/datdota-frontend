import styles from './Terms.module.css'

export default function DataPolicy() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Data Processing Policy</h1>
      <p className={styles.text}>
        <em>Effective date: 20 March 2026 &mdash; Last updated: 20 March 2026</em>
      </p>

      <section className={styles.section}>
        <h2 className={styles.heading}>1. Purpose</h2>
        <p className={styles.text}>
          This Data Processing Policy describes how datdota.com (&ldquo;datdota&rdquo;) collects,
          processes, and stores data in the course of providing esports statistics for the video
          game Dota&nbsp;2. This policy supplements our{' '}
          <a href="/privacy">Privacy Policy</a> and{' '}
          <a href="/terms">Terms of Service</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>2. Categories of Data Processed</h2>

        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 'var(--space-xs)', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
          2.1 Publicly Available Game Data
        </h3>
        <p className={styles.text}>
          We process Dota&nbsp;2 match data that is made publicly available by Valve Corporation
          through their APIs and downloadable replay files. This includes:
        </p>
        <ul className={styles.list}>
          <li>Match metadata (match ID, date, duration, game mode, lobby type)</li>
          <li>Player performance data (heroes picked, items purchased, kills, deaths, assists, GPM, XPM, and other in-game statistics)</li>
          <li>Draft information (pick/ban sequences)</li>
          <li>Team affiliations and rosters</li>
          <li>Player Steam IDs and in-game display names</li>
          <li>League and tournament metadata</li>
        </ul>

        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 'var(--space-xs)', fontFamily: 'var(--font-display)', fontWeight: 800, marginTop: 'var(--space-md)' }}>
          2.2 Derived &amp; Computed Data
        </h3>
        <p className={styles.text}>
          From the raw game data above, we compute derived statistics including but not limited to:
        </p>
        <ul className={styles.list}>
          <li>Player and team Elo / Glicko ratings</li>
          <li>Win/loss records, streaks, and historical trends</li>
          <li>Hero performance aggregates (pick rates, win rates, item builds)</li>
          <li>Draft analysis and meta-game statistics</li>
        </ul>
        <p className={styles.text}>
          These derived statistics are based entirely on publicly available game data and do not
          involve any additional personal data collection.
        </p>

        <h3 style={{ fontSize: '0.9rem', color: 'var(--color-text)', marginBottom: 'var(--space-xs)', fontFamily: 'var(--font-display)', fontWeight: 800, marginTop: 'var(--space-md)' }}>
          2.3 Technical Data
        </h3>
        <p className={styles.text}>
          When you access datdota, the following technical data is automatically collected by our
          web server and CDN provider (Cloudflare):
        </p>
        <ul className={styles.list}>
          <li>IP address</li>
          <li>Browser type and version (user-agent string)</li>
          <li>Requested URL and referrer</li>
          <li>Date and time of access</li>
          <li>HTTP status code and response size</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>3. Legal Basis &amp; Purposes</h2>
        <p className={styles.text}>
          All data processing is carried out in compliance with the General Data Protection
          Regulation (EU) 2016/679 (GDPR). The specific legal bases are:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Legitimate interest (Art.&nbsp;6(1)(f) GDPR)</strong> &mdash; Processing of
            publicly available Dota&nbsp;2 match data to provide esports statistics. The legitimate
            interest is the provision of a comprehensive, publicly accessible esports statistics
            service that benefits the Dota&nbsp;2 community, tournament organisers, teams, players,
            analysts, and fans. We have conducted a balancing test and concluded that the interests
            of data subjects are not overridden, given that the data is already public and the
            processing provides significant community benefit.
          </li>
          <li>
            <strong>Legitimate interest (Art.&nbsp;6(1)(f) GDPR)</strong> &mdash; Processing of
            server access logs for the purposes of security, abuse prevention, and service
            reliability.
          </li>
          <li>
            <strong>Contract performance (Art.&nbsp;6(1)(b) GDPR)</strong> &mdash; Processing
            necessary to deliver the service as described in the Terms of Service.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>4. Data Sources</h2>
        <ul className={styles.list}>
          <li>
            <strong>Valve Corporation</strong> &mdash; match data obtained via the Steam Web API
            and downloadable replay files, both of which are publicly provided by Valve.
          </li>
          <li>
            <strong>Community contributions</strong> &mdash; tournament and league metadata may be
            supplemented with information provided by tournament organisers or community members.
          </li>
          <li>
            <strong>Automated server logs</strong> &mdash; generated automatically when you visit
            the website.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>5. Data Retention</h2>
        <ul className={styles.list}>
          <li>
            <strong>Match data</strong> &mdash; retained indefinitely as part of the historical
            esports archive. This data serves an important archival and research purpose for the
            Dota&nbsp;2 community.
          </li>
          <li>
            <strong>Server access logs</strong> &mdash; retained for up to 90 days, then
            automatically deleted.
          </li>
          <li>
            <strong>Derived statistics</strong> &mdash; retained indefinitely alongside the source
            match data.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>6. Sub-processors</h2>
        <p className={styles.text}>
          The following third-party sub-processors may process data on our behalf:
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Cloudflare, Inc.</strong> (San Francisco, USA) &mdash; CDN, DDoS protection,
            DNS resolution. Cloudflare processes request data (IP addresses, headers) to deliver
            and protect the website. Transfer mechanism: EU Standard Contractual Clauses and
            Cloudflare&rsquo;s Data Processing Addendum.
          </li>
        </ul>
        <p className={styles.text}>
          Our application servers are hosted in the European Union.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>7. Security Measures</h2>
        <p className={styles.text}>
          We implement appropriate technical and organisational measures to protect data, including:
        </p>
        <ul className={styles.list}>
          <li>TLS encryption for all data in transit</li>
          <li>DDoS protection and Web Application Firewall via Cloudflare</li>
          <li>Access controls limiting database and server access to authorised personnel</li>
          <li>Regular security updates and patching</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>8. Data Subject Rights</h2>
        <p className={styles.text}>
          Individuals whose data is processed by datdota have rights under the GDPR as described
          in our <a href="/privacy">Privacy Policy</a>, including the rights of access,
          rectification, erasure, restriction, portability, and objection. Requests should be
          directed to <a href="bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>.
        </p>
        <p className={styles.text}>
          Please note that requests for erasure of publicly available match data will be assessed
          on a case-by-case basis, taking into account the public nature of the data and the
          archival purpose of the service.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>9. Changes</h2>
        <p className={styles.text}>
          This Data Processing Policy may be updated from time to time. The &ldquo;Last
          updated&rdquo; date at the top of this page will be revised accordingly.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>10. Contact</h2>
        <p className={styles.text}>
          For any questions regarding data processing, contact:{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>
        </p>
      </section>
    </div>
  )
}
