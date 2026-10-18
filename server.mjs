/**
 * SOLARIS — zero-dependency local server.
 * ES modules and texture fetches require HTTP, so open the page through this.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || process.argv.find((a) => /^\d+$/.test(a)) || 8080);
const shouldOpen = process.argv.includes('--open');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const server = createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = normalize(join(root, pathname));
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — this star is not in the catalogue.');
      return;
    }
    res.writeHead(200, {
      'Content-Type': types[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    });
    createReadStream(file).pipe(res);
  } catch (err) {
    res.writeHead(500); res.end('Internal error');
  }
});

server.listen(port, () => {
  const url = `http://localhost:${port}/`;
  console.log('');
  console.log('  SOLARIS — solar system observatory');
  console.log(`  ${url}`);
  console.log('  Ctrl+C to close the observatory.');
  console.log('');
  if (shouldOpen) {
    const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
    const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
    try { spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref(); } catch {}
  }
});
