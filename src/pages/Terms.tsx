import styles from './Terms.module.css'

export default function Terms() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Terms of Service</h1>

      <section className={styles.section}>
        <h2 className={styles.heading}>1. Terms</h2>
        <p className={styles.text}>
          By accessing datdota.com and its subdomains, you agree to be bound by these Terms of
          Service, all applicable laws and regulations, and agree that you are responsible for
          compliance with any applicable local laws. If you do not agree with any of these terms, you
          are prohibited from using or accessing this site. The materials contained on this website
          are protected by applicable copyright and trademark law.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>2. Use Licence</h2>
        <p className={styles.text}>
          Permission is granted to temporarily download one copy of the materials on datdota for
          personal, non-commercial transitory viewing only. This is the grant of a licence, not a
          transfer of title, and under this licence you may not:
        </p>
        <ul className={styles.list}>
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose, or for any public display (commercial or non-commercial) without a licence</li>
          <li>Attempt to decompile or reverse engineer any software contained on datdota</li>
          <li>Remove any copyright or other proprietary notations from the materials</li>
          <li>Transfer the materials to another person or mirror the materials on any other server</li>
        </ul>
        <p className={styles.text}>
          This licence shall automatically terminate if you violate any of these restrictions and may
          be terminated by datdota at any time.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>3. Research &amp; Citation</h2>
        <p className={styles.text}>
          Data obtained from datdota may be used for public research purposes provided that datdota
          is cited as the source. Commercial use of the data requires contacting us for a licence.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>4. Disclaimer</h2>
        <p className={styles.text}>
          The materials on datdota are provided on an &lsquo;as is&rsquo; basis. datdota makes no
          warranties, expressed or implied, and hereby disclaims and negates all other warranties
          including, without limitation, implied warranties or conditions of merchantability, fitness
          for a particular purpose, or non-infringement of intellectual property or other violation
          of rights.
        </p>
        <p className={styles.text}>
          Further, datdota does not warrant or make any representations concerning the accuracy,
          likely results, or reliability of the use of the materials on its website or otherwise
          relating to such materials or on any sites linked to this site.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>5. Limitations</h2>
        <p className={styles.text}>
          In no event shall datdota or its suppliers be liable for any damages (including, without
          limitation, damages for loss of data or profit, or due to business interruption) arising
          out of the use or inability to use the materials on datdota, even if datdota or a datdota
          authorised representative has been notified orally or in writing of the possibility of such
          damage.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>6. Accuracy of Materials</h2>
        <p className={styles.text}>
          The materials appearing on datdota could include technical, typographical, or photographic
          errors. datdota does not warrant that any of the materials on its website are accurate,
          complete or current. datdota may make changes to the materials contained on its website at
          any time without notice.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>7. Links</h2>
        <p className={styles.text}>
          datdota has not reviewed all of the sites linked to its website and is not responsible for
          the contents of any such linked site. The inclusion of any link does not imply endorsement
          by datdota. Use of any such linked website is at the user&rsquo;s own risk.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>8. Modifications</h2>
        <p className={styles.text}>
          datdota may revise these Terms of Service at any time without notice. By using this website
          you agree to be bound by the then current version of these Terms of Service.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>9. Governing Law</h2>
        <p className={styles.text}>
          These terms and conditions are governed by and construed in accordance with the laws of
          Germany and you irrevocably submit to the exclusive jurisdiction of the courts in that
          location.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>10. Trademarks</h2>
        <p className={styles.text}>
          Dota 2 is a registered trademark of Valve Corporation. datdota is not affiliated with or
          endorsed by Valve Corporation.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Related Policies</h2>
        <ul className={styles.list}>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/data-policy">Data Processing Policy</a></li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>API Usage</h2>
        <p className={styles.text}>
          The datdota API is not designed as a replacement for Valve&rsquo;s APIs. Please observe the
          following rules:
        </p>
        <ul className={styles.list}>
          <li>Maintain a minimum 3-second interval between API requests</li>
          <li>Some endpoints require an API key</li>
          <li>If you need more than 500 requests per day, contact Noxville on Discord</li>
          <li>HTTP 429 responses indicate you have been rate-limited</li>
          <li>If your IP is blocked, contact support rather than attempting to evade the ban</li>
          <li>Frontend code should proxy and cache data to reduce API load</li>
        </ul>
      </section>
    </div>
  )
}
