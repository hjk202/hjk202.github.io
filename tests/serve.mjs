import { createServer } from 'node:http';
import process from 'node:process';
import { URL } from 'node:url';
import { log } from 'node:console';
import { readFile } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
const directory = resolve(process.env.E2E_DIST ?? 'dist');
const base = process.env.E2E_BASE_PATH ?? '/';
const mime = { '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml' };
createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (!url.pathname.startsWith(base)) throw new Error('Outside base');
    const path = decodeURIComponent(url.pathname.slice(base.length));
    const file = resolve(directory, path.endsWith('/') || !path ? `${path}index.html` : path);
    if (!file.startsWith(`${directory}${sep}`)) throw new Error('Outside output');
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    try {
      const page = await readFile(resolve(directory, '404.html'));
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(page);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Not found');
    }
  }
}).listen(Number(process.env.E2E_PORT ?? 4410), '127.0.0.1', () => log('Production test server ready'));
