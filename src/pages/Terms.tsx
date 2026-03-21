import { Link } from 'react-router-dom'
import styles from './Terms.module.css'

export default function Terms() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Terms of Service</h1>
      <p className={styles.text}>
        <em>Version 1 &mdash; Effective date: 21 March 2026</em>
      </p>

      <section className={styles.section}>
        <h2 className={styles.heading}>1. Terms</h2>
        <p className={styles.text}>
          By accessing datdota.com and its subdomains, you agree to be bound by these Terms of
          Service, all applicable laws and regulations, and agree that you are responsible for
          compliance with any applicable local laws. If you do not agree with any of these terms, you
          are prohibited from using or accessing this site.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>2. Age Requirement</h2>
        <p className={styles.text}>
          You must be at least 16 years of age to use datdota. By using this site you confirm that
          you meet this age requirement. If you are under 16, you may not access or use the site.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>3. Use Licence &amp; Database Rights</h2>
        <p className={styles.text}>
          The underlying Dota&nbsp;2 match data is provided by Valve Corporation through their
          public APIs and replay files. datdota&rsquo;s compiled database &mdash; including its
          selection, arrangement, statistical analysis, derived ratings, and presentation of that
          data &mdash; is protected under the EU Database Directive (96/9/EC) and applicable
          copyright law.
        </p>
        <p className={styles.text}>
          You are granted a limited, non-exclusive licence to access and view the materials on
          datdota for personal, non-commercial purposes. Under this licence you may:
        </p>
        <ul className={styles.list}>
          <li>
            Quote or reference small portions of datdota&rsquo;s data (e.g.&nbsp;individual
            statistics, screenshots, tables) in articles, social media posts, broadcasts, or
            academic work, provided you credit datdota as the source
          </li>
          <li>
            Use data obtained from datdota for non-commercial research, provided datdota is cited
          </li>
        </ul>
        <p className={styles.text}>
          Under this licence you may <strong>not</strong>:
        </p>
        <ul className={styles.list}>
          <li>Systematically extract or re-utilise substantial portions of the database</li>
          <li>
            Use any data from datdota for commercial purposes without a separate licence agreement
          </li>
          <li>Attempt to decompile or reverse engineer any software contained on datdota</li>
          <li>
            Mirror, scrape, or redistribute the database or substantial parts thereof on any other
            server or service
          </li>
          <li>Remove any copyright or proprietary notations from the materials</li>
        </ul>
        <p className={styles.text}>
          Commercial use of datdota data (including but not limited to betting, analytics products,
          or paid content) requires a written licence. Contact us at{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>.
        </p>
        <p className={styles.text}>
          This licence shall automatically terminate if you violate any of these restrictions and may
          be terminated by datdota at any time.
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
        <h2 className={styles.heading}>5. Limitation of Liability</h2>
        <p className={styles.text}>
          datdota bears <strong>unlimited liability</strong> for damages caused by wilful
          misconduct (Vorsatz) or gross negligence (grobe Fahrl&auml;ssigkeit), as well as for
          injury to life, body, or health.
        </p>
        <p className={styles.text}>
          For <strong>slight negligence</strong> (einfache Fahrl&auml;ssigkeit), datdota is liable
          only for breach of material contractual obligations (wesentliche Vertragspflichten /
          Kardinalpflichten) &mdash; that is, obligations whose fulfilment is essential to the
          proper performance of the contract and on whose compliance you may regularly rely. In such
          cases, liability is limited to the foreseeable, typically occurring damage.
        </p>
        <p className={styles.text}>
          Liability under the German Product Liability Act (Produkthaftungsgesetz) remains
          unaffected.
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
          datdota may revise these Terms of Service from time to time. Material changes will be
          indicated by incrementing the version number at the top of this page. When the Terms are
          updated, you will be asked to review and re-accept them before continuing to use the site.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>9. Governing Law &amp; Jurisdiction</h2>
        <p className={styles.text}>
          These terms and conditions are governed by and construed in accordance with the laws of the
          Federal Republic of Germany. You irrevocably submit to the exclusive jurisdiction of the
          courts of Berlin, Germany.
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
        <h2 className={styles.heading}>11. Impressum (Legal Notice)</h2>
        <p className={styles.text}>
          Information in accordance with &sect;5 DDG (Digitale-Dienste-Gesetz):
        </p>
        <p className={styles.text}>
          <strong>Operator:</strong> Bernard Steenhuisen<br />
          <strong>Address:</strong> 15 Otawistrasse, 13351 Berlin<br />
          <strong>Email:</strong>{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>
        </p>
        <p className={styles.text}>
          <strong>Responsible for content in accordance with &sect;18(2) MStV:</strong><br />
          Bernard Steenhuisen (address as above)
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Related Policies</h2>
        <ul className={styles.list}>
          <li><Link to="/privacy">Privacy Policy</Link></li>
          <li><Link to="/data-policy">Data Processing Policy</Link></li>
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

      <section className={styles.section}>
        <h2 className={styles.heading}>Contact</h2>
        <p className={styles.text}>
          For questions about these terms, contact:{' '}
          <a href="mailto:bensteenhuisen+datdota@gmail.com">bensteenhuisen+datdota@gmail.com</a>
        </p>
      </section>
    </div>
  )
}
