// Local dev server: static files, SPA fallback and the /api functions on one port.
// Run: node dev.js   (reads .env if present)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3471;
const ROOT = __dirname;
const loaded = new Map(); // api file -> mtime it was loaded at

const HEADERS = (JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')).headers || [])
  .flatMap((h) => h.headers);
const PRIVATE = /(^|\/)(\.[^/]*|CLAUDE\.md|[^/]*\.md|dev\.js|supabase|node_modules|package(-lock)?\.json)(\/|$)/i;
process.env.ZEEP_DEV = '1'; // lets the registry fall back to .data/ without Supabase

try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8'
};

function handle(req, res, name) {
  const file = path.join(ROOT, 'api', name + '.js');
  if (name.startsWith('_') || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  const mtime = fs.statSync(file).mtimeMs;
  if (loaded.get(file) !== mtime) { delete require.cache[file]; loaded.set(file, mtime); }
  return Promise.resolve(require(file)(req, res)).catch((e) => {
    console.error(e);
    res.statusCode = 500;
    res.end('Function error');
  });
}

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  for (const h of HEADERS) res.setHeader(h.key, h.value);

  if (pathname.startsWith('/api/')) {
    return handle(req, res, path.basename(pathname));
  }

  let file = path.join(ROOT, pathname);
  const inside = file.startsWith(ROOT + path.sep);
  if (!inside || PRIVATE.test(path.relative(ROOT, file).split(path.sep).join('/')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    file = path.join(ROOT, 'index.html');
  }
  res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`ZEEP dev server on http://localhost:${PORT}`));
