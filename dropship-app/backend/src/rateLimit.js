// Small in-memory fixed-window limiter per client IP. Fine for a single instance.
export function rateLimit({ max, windowMs }) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset <= now) hits.delete(k); }, windowMs).unref();
  return (req, res, next) => {
    const now = Date.now();
    let h = hits.get(req.ip);
    if (!h || h.reset <= now) hits.set(req.ip, (h = { n: 0, reset: now + windowMs }));
    if (++h.n > max) {
      res.set('retry-after', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: 'too many attempts, try again shortly' });
    }
    next();
  };
}
