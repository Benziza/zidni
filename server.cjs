const http = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const port = Number(process.env.PORT) || 4173;
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/locales.js': ['locales.js', 'text/javascript; charset=utf-8'],
  '/language.js': ['language.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8']
};

const server = http.createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = files[pathname];

  if (!file) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  try {
    const content = await readFile(path.join(__dirname, file[0]));
    response.writeHead(200, {
      'Content-Type': file[1],
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(500);
    response.end('Could not load the page');
  }
});

server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Zidni is running at http://localhost:${port}`);
});
