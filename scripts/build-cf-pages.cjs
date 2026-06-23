/**
 * Emits static HTML pages for Cloudflare error/challenge integration.
 *
 * These pages MUST be plain server-rendered HTML (no React, no JS bundle) so
 * Cloudflare's validator can see the `::CAPTCHA_BOX::` token in the raw
 * response. nginx should serve /cfattack and /cf500 from these files directly
 * instead of falling through to index.html.
 */

const fs = require('node:fs')
const path = require('node:path')

const distDir = path.resolve(__dirname, '..', 'dist')

const DISCORD_NOTE =
  'If you believe this is a mistake, please contact us on <a class="link" href="https://discord.gg/datdota">Discord</a>.'

const pages = [
  {
    file: 'cfattack.html',
    errorType: 'cfattack',
    title: 'Access Denied',
    description: 'Your request was blocked.',
    image: 'https://cdn.datdota.com/images/errors/sad3.png',
    heading: 'Access Denied',
    message: `Your request was blocked. ${DISCORD_NOTE}`,
    cfToken: '::CAPTCHA_BOX::',
  },
  {
    file: 'cf500.html',
    errorType: 'cf500',
    title: 'Internal Server Error',
    description: 'Something went wrong.',
    image: 'https://cdn.datdota.com/images/errors/sad1.png',
    heading: 'Internal Server Error',
    message: 'Something went wrong on our end. Please try again later.',
    cfToken: '::CLOUDFLARE_ERROR_500S_BOX::',
  },
  {
    file: 'cfwafblock.html',
    errorType: 'cfwafblock',
    title: 'Request Blocked',
    description: 'Your request was blocked by our security rules.',
    image: 'https://cdn.datdota.com/images/errors/sad3.png',
    heading: 'Request Blocked',
    message: `Your request was blocked by our web application firewall. ${DISCORD_NOTE}`,
    cfToken: '::WAF_BLOCK_DETAIL_BOX::',
  },
  {
    file: 'cfinteractivechallenge.html',
    errorType: 'cfinteractivechallenge',
    title: 'Verifying You Are Human',
    description: 'Please complete the challenge below to continue.',
    image: 'https://cdn.datdota.com/images/errors/sad2.png',
    heading: 'Verifying You Are Human',
    message: 'Please complete the challenge below to continue.',
    cfToken: '::CAPTCHA_BOX::',
  },
  {
    file: 'cfipblock.html',
    errorType: 'cfipblock',
    title: 'Access Restricted',
    description: 'Access from your location or network is restricted.',
    image: 'https://cdn.datdota.com/images/errors/sad3.png',
    heading: 'Access Restricted',
    message: `Access from your location or network is restricted. ${DISCORD_NOTE}`,
    cfToken: '::IP_DENIED_BOX::',
  },
]

const STYLES = `
  :root {
    --color-bg-deep: #0a0a12;
    --color-bg-elevated: #1e1e38;
    --color-border: #2a2a4a;
    --color-text: #e8e6f0;
    --color-text-muted: #6e6b80;
    --color-accent-bright: #2dd4bf;
    --color-primary: #c48bc4;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    min-height: 100vh;
    background: var(--color-bg-deep);
    color: var(--color-text);
    font-family: 'Fira Code', monospace;
    font-weight: 300;
  }
  .container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 2.5rem 1rem;
    min-height: 100vh;
  }
  /* Hide any list elements that may be injected by Cloudflare. */
  ul, ol { display: none; }
  .logo {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 800;
    font-size: 1.5rem;
    color: var(--color-primary);
    letter-spacing: -0.5px;
    text-decoration: none;
    margin-bottom: 2.5rem;
  }
  .logo:hover { color: var(--color-accent-bright); }
  .image {
    width: 180px;
    height: auto;
    margin-bottom: 1.5rem;
    opacity: 0.85;
  }
  .title {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 800;
    font-size: 1.5rem;
    color: var(--color-text);
    margin: 0 0 0.5rem;
  }
  .message {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin: 0 0 1.5rem;
    max-width: 480px;
  }
  .captcha {
    margin-top: 0.5rem;
    min-height: 80px;
  }
  .home {
    font-size: 0.85rem;
    color: var(--color-accent-bright);
    text-decoration: none;
  }
  .home:hover { color: var(--color-primary); }
  .link {
    color: var(--color-accent-bright);
    text-decoration: none;
  }
  .link:hover { color: var(--color-primary); }
  .diagnostics {
    margin-top: 2rem;
    padding: 12px 16px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 4px;
    font-family: 'Fira Code', monospace;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-align: left;
    max-width: 480px;
    width: 100%;
  }
  .diagnostics .label {
    display: inline-block;
    width: 70px;
    color: var(--color-text-muted);
  }
  .diagnostics .value {
    color: var(--color-text);
    word-break: break-all;
  }
  .diagnostics .row + .row { margin-top: 4px; }
`

function renderPage(p) {
  return `<!doctype html>
<!-- error-type: ${p.errorType} -->
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#0a0a12" />
    <meta name="robots" content="noindex" />
    <meta name="x-error-type" content="${p.errorType}" />
    <title>${p.title} — datdota</title>
    <meta name="description" content="${p.description}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon.ico" sizes="any" />
    <link rel="preconnect" href="https://cdn.datdota.com" crossorigin />
    <link rel="preload" as="font" type="font/woff2" crossorigin
          href="https://cdn.datdota.com/fonts/fira-code-v27-latin-300.woff2" />
    <link rel="preload" as="font" type="font/woff2" crossorigin
          href="https://cdn.datdota.com/fonts/plus-jakarta-sans-v12-latin-800.woff2" />
    <style>
      @font-face {
        font-family: 'Fira Code';
        font-style: normal;
        font-weight: 300;
        font-display: swap;
        src: url('https://cdn.datdota.com/fonts/fira-code-v27-latin-300.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Plus Jakarta Sans';
        font-style: normal;
        font-weight: 800;
        font-display: swap;
        src: url('https://cdn.datdota.com/fonts/plus-jakarta-sans-v12-latin-800.woff2') format('woff2');
      }
${STYLES}
    </style>
  </head>
  <body>
    <div class="container">
      <a href="/" class="logo">datdota</a>
      <img src="${p.image}" alt="${p.heading}" class="image" />
      <h1 class="title">${p.heading}</h1>
      <p class="message">${p.message}</p>
${p.cfToken ? `      <div class="captcha">${p.cfToken}</div>\n` : ''}      <a class="home" href="/">Return to home</a>
      <div class="diagnostics">
        <div class="row"><span class="label">IP</span><span class="value">::CLIENT_IP::</span></div>
        <div class="row"><span class="label">Ray ID</span><span class="value">::RAY_ID::</span></div>
        <div class="row"><span class="label">Region</span><span class="value">::GEO::</span></div>
      </div>
    </div>
  </body>
</html>
`
}

if (!fs.existsSync(distDir)) {
  console.error(`[build-cf-pages] dist/ not found at ${distDir}. Run vite build first.`)
  process.exit(1)
}

for (const p of pages) {
  const out = path.join(distDir, p.file)
  fs.writeFileSync(out, renderPage(p), 'utf8')
  console.log(`[build-cf-pages] wrote ${out}`)
}
