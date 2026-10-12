// Per-IP fixed-window rate limit. State lives in one function instance, so on
// Vercel it slows abuse down rather than stopping it outright; put the Vercel
// Firewall (or Upstash) in front for hard limits once traffic grows.

const windows = new Map<string, { start: number; count: number }>();

export function clientIp(req: Request) {
  const fwd = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return fwd || "unknown";
}

export function allow(bucket: string, max: number, id: string, windowMs = 60000) {
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
  return w.count <= max;
}
