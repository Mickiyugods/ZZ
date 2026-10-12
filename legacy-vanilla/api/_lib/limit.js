// Per-IP fixed-window rate limit. State lives in one function instance, so on
// Vercel it slows abuse down rather than stopping it outright; put the Vercel
// Firewall (or Upstash) in front for hard limits once traffic grows.

const windows = new Map();

function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket?.remoteAddress || 'unknown';
}

function allow(req, res, bucket, max, windowMs = 60000, id = clientIp(req)) {
  const key = `${bucket}:${id}`;
  const now = Date.now();
  let w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    w = { start: now, count: 0 };
    windows.set(key, w);
  }
  w.count += 1;
  if (windows.size > 20000) {
    for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
  }
  if (w.count <= max) {
    res.setHeader('X-RateLimit-Remaining', String(max - w.count));
    return true;
  }
  res.statusCode = 429;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Retry-After', String(Math.ceil((w.start + windowMs - now) / 1000)));
  res.end(JSON.stringify({ error: 'Too many requests, slow down' }));
  return false;
}

module.exports = { allow };
