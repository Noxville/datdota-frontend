import styles from './About.module.css'

interface PersonLink {
  type: 'x' | 'web'
  href: string
}

interface Person {
  name: string
  role: string
  links?: PersonLink[]
}

const PEOPLE: Person[] = [
  {
    name: 'Martin Decoud',
    role: 'Original founder of datdota and maintainer January 2013 \u2013 June 2016',
  },
  {
    name: 'Ben \u2018Noxville\u2019 Steenhuisen',
    role: 'Maintainer from June 2016 \u2013 today',
    links: [{ type: 'x', href: 'https://x.com/noxville' }],
  },
  {
    name: 'Robin \u2018Invokr\u2019 Dietrich',
    role: 'Creator of many excellent Dota 2 tools, and writer of replay parser',
    links: [{ type: 'x', href: 'https://x.com/invokr' }],
  },
  {
    name: 'Alan \u2018Nahaz\u2019 Bester',
    role: 'One of the site\u2019s directors and key Dota statistics evangelist',
    links: [{ type: 'x', href: 'https://x.com/NahazDota' }],
  },
  {
    name: 'Anthony \u2018scant\u2019 Hodgson',
    role: 'Enigmatic idea creator',
    links: [{ type: 'x', href: 'https://x.com/scantzor' }],
  },
  {
    name: 'Martin Schrodt',
    role: 'Developer of the excellent Source Replay Parser, Clarity',
    links: [{ type: 'web', href: 'http://schrodt.org/home.html' }],
  },
  {
    name: 'The Standard Deviants',
    role: 'Who give great feedback and suggestions on an ongoing basis',
    links: [{ type: 'x', href: 'https://x.com/StDevStats' }],
  },
]

function LinkIcon({ type }: { type: 'x' | 'web' }) {
  if (type === 'x') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}

export default function About() {
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>About datdota</h1>

      <section className={styles.section}>
        <h2 className={styles.heading}>A Brief History</h2>
        <p className={styles.text}>
          datdota was created in 2013 by Martin Decoud. He was the sole developer until mid-2016,
          when Noxville took over the running of the site and relaunched it towards the middle of
          2017. The site was originally a PHP frontend with a MySQL backend, using smoke and clarity
          (and some R scripts) to keep the parsing going. In its latest incarnation it runs on Grails
          with Postgres, using clarity2 for parsing.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Achievements</h2>
        <p className={styles.text}>
          We are probably the only Dota 2 stats site that&rsquo;s not in contravention of the Steam
          &amp; Steam WebAPIs Terms of Service. Yay! Go us!
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Our Thanks</h2>
        <p className={styles.text}>
          datdota wouldn&rsquo;t be possible without the following people and technologies:
        </p>
        <ul className={styles.people}>
          {PEOPLE.map((p) => (
            <li key={p.name} className={styles.person}>
              <div className={styles.personInfo}>
                <span className={styles.personName}>{p.name}</span>
                <span className={styles.personRole}>{p.role}</span>
              </div>
              {p.links && p.links.length > 0 && (
                <div className={styles.personLinks}>
                  {p.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.personLink}
                      title={link.type === 'x' ? 'X / Twitter' : 'Website'}
                    >
                      <LinkIcon type={link.type} />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
          <li className={styles.personEllipsis}>And many more&hellip;</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Support Us</h2>
        <p className={styles.text}>
          If you find datdota useful, consider supporting us on{' '}
          <a href="https://ko-fi.com/datdota" target="_blank" rel="noreferrer">
            Ko-fi
          </a>
          . Your support helps keep the servers running and the data flowing.
        </p>
      </section>
    </div>
  )
}
