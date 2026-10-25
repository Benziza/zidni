const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { promisify } = require('node:util');
const zlib = require('node:zlib');
const brotli = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

const port = Number(process.env.PORT) || 4173;
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/locales.js': ['locales.js', 'text/javascript; charset=utf-8'],
  '/language.js': ['language.js', 'text/javascript; charset=utf-8'],
  '/topics.js': ['topics.js', 'text/javascript; charset=utf-8'],
  '/quick.js': ['quick.js', 'text/javascript; charset=utf-8'],
  '/sitemap.xml': ['sitemap.xml', 'application/xml; charset=utf-8'],
  '/social-card.png': ['social-card.png', 'image/png'],
  '/robots.txt': ['robots.txt', 'text/plain; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8']
};

function preferredEncoding(header = '') {
  const accepted = Object.fromEntries(header.split(',').map((part) => {
    const [name, ...parameters] = part.trim().toLowerCase().split(';');
    const weight = parameters.map((value) => value.trim()).find((value) => value.startsWith('q='));
    const quality = weight ? Number(weight.slice(2)) : 1;
    return [name, Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0];
  }));
  return ['br', 'gzip'].map((name) => ({ name, quality: accepted[name] ?? accepted['*'] ?? 0 }))
    .filter((item) => item.quality > 0).sort((a, b) => b.quality - a.quality)[0]?.name || '';
}

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let pathname;
  try { pathname = new URL(request.url, 'http://localhost').pathname; }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  if (pathname === '/index.html') {
    response.writeHead(301, { Location: '/' }); response.end(); return;
  }
  const file = files[pathname];

  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  try {
    let content = await readFile(path.join(__dirname, file[0]));
    const headers = {
      'Content-Type': file[1],
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      Vary: 'Accept-Encoding'
    };
    const encoding = content.length > 1024 && !file[1].startsWith('image/')
      ? preferredEncoding(request.headers['accept-encoding']) : '';
    if (encoding) {
      content = encoding === 'br'
        ? await brotli(content, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } })
        : await gzip(content);
      headers['Content-Encoding'] = encoding;
    }
    headers.ETag = '"' + createHash('sha256').update(content).digest('hex').slice(0, 24) + '"';
    const tags = (request.headers['if-none-match'] || '').split(',').map((tag) => tag.trim().replace(/^W\//, ''));
    if (tags.includes('*') || tags.includes(headers.ETag)) {
      response.writeHead(304, headers); response.end(); return;
    }
    headers['Content-Length'] = content.length;
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end(error.code === 'ENOENT' ? 'Not found' : 'Could not load the page');
  }
});

server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Zidni is running at http://localhost:${port}`);
});
