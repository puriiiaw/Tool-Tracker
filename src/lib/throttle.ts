// Login brake: `max` wrong tries inside `windowMs` locks that key until the window passes.
// ponytail: counts live in memory and reset on restart; fine for one server process.
export function makeThrottle(max = 5, windowMs = 15 * 60_000) {
  const fails = new Map<string, { n: number; at: number }>();
  const live = (key: string, now: number) => {
    const f = fails.get(key);
    return f && now - f.at < windowMs ? f : undefined;
  };
  return {
    locked: (key: string, now = Date.now()) => (live(key, now)?.n ?? 0) >= max,
    fail: (key: string, now = Date.now()) => void fails.set(key, { n: (live(key, now)?.n ?? 0) + 1, at: now }),
    ok: (key: string) => void fails.delete(key),
  };
}
