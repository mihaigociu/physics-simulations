// Minimal static server for the e2e tests: serves dist/ under the site's
// base path the way GitHub Pages does (index.html for folders, 404.html for
// anything missing). No dependencies, runs in the foreground.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const [, , port = '4330', base = '/physics-simulations/'] = process.argv;
const root = join(import.meta.dirname, '../../dist');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
  '.png': 'image/png',
};

async function resolve(urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  let file = join(root, rel);
  const info = await stat(file).catch(() => null);
  if (info?.isDirectory()) file = join(file, 'index.html');
  return (await stat(file).catch(() => null))?.isFile() ? file : null;
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://x').pathname;
  const file = path.startsWith(base) ? await resolve(path.slice(base.length)) : null;
  if (!file) {
    res.writeHead(404, { 'content-type': types['.html'] });
    res.end(await readFile(join(root, '404.html')).catch(() => 'Not found'));
    return;
  }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
}).listen(Number(port), () => console.log(`serving dist/ at http://localhost:${port}${base}`));
