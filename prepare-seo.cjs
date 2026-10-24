'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isIP } = require('node:net');
let site;
try { site = new URL(process.argv[2]); }
catch { console.error('Usage: npm run prepare:seo -- https://your-domain.tld'); process.exit(1); }
if (site.protocol !== 'https:' || site.username || site.password || site.port ||
    !/^\/[A-Za-z0-9/_-]*$/.test(site.pathname) || site.search || site.hash || isIP(site.hostname) ||
    !site.hostname.includes('.') || /(^localhost$|\.(localhost|local|invalid|test)$)/.test(site.hostname)) {
  console.error('Use a public HTTPS site URL without a port, credentials, query, or fragment.');
  process.exit(1);
}
const base = site.origin + (site.pathname.endsWith('/') ? site.pathname : site.pathname + '/');
const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const indexPath = path.join(__dirname, 'index.html');
const html = fs.readFileSync(indexPath, 'utf8');
const marker = /  <!-- PUBLIC_SEO_START -->[\s\S]*?  <!-- PUBLIC_SEO_END -->/;
if (!marker.test(html) || !fs.existsSync(path.join(__dirname, 'social-card.png'))) {
  console.error('The SEO markers or social card are missing. No files were changed.');
  process.exit(1);
}
const metadata = [
  `  <link rel="canonical" href="${escape(base)}">`,
  `  <meta property="og:url" content="${escape(base)}">`,
  `  <meta property="og:image" content="${escape(base + 'social-card.png')}">`,
  '  <meta property="og:image:width" content="1200">',
  '  <meta property="og:image:height" content="630">',
  '  <meta property="og:image:alt" content="Zidni — Read a little. Keep what you like.">',
  `  <meta name="twitter:image" content="${escape(base + 'social-card.png')}">`,
  `  <script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Zidni', url: base, inLanguage: ['en', 'fr', 'ar', 'ary'] }).replaceAll('<', '\\u003c')}</script>`
].join('\n');
fs.writeFileSync(indexPath, html.replace(marker, `  <!-- PUBLIC_SEO_START -->\n${metadata}\n  <!-- PUBLIC_SEO_END -->`));
fs.writeFileSync(path.join(__dirname, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${base}sitemap.xml\n`);
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(base)}</loc></url></urlset>\n`);
console.log(`Prepared canonical, social URLs, robots.txt, and sitemap.xml for ${base}`);
