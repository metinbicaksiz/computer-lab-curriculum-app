// Slows down password guessing. The everyday limits are per computer (IP
// address), so a student can't easily lock a classmate out by typing the
// classmate's username with wrong passwords:
//  - 5 wrong passwords for one username from one computer  -> wait 5 minutes
//  - 20 wrong passwords in total from one computer         -> wait 15 minutes
// The address is set by web/server.mjs from the real connection, so it can't
// be faked. Backstop in case someone runs the web app another way (e.g. plain
// `next start`, where every request looks like it comes from this machine):
// a cap per username across ALL computers:
//  - 50 wrong passwords for one username from anywhere     -> wait 15 minutes
// Failed logins are logged with the address, so the teacher can see who tried.
// Counts are kept in memory; restarting the server clears them.

const PER_USER = { max: 5, windowMs: 5 * 60_000 };
const PER_IP = { max: 20, windowMs: 15 * 60_000 };
const PER_NAME = { max: 50, windowMs: 15 * 60_000 };

type Bucket = { fails: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function get(key: string, windowMs: number, now: number) {
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { fails: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  return b;
}

/** Returns seconds to wait if this computer is locked out for this username, else 0. */
export function lockedFor(ip: string, username: string, now = Date.now()) {
  const user = get(`u:${ip}:${username}`, PER_USER.windowMs, now);
  const all = get(`ip:${ip}`, PER_IP.windowMs, now);
  const name = get(`n:${username}`, PER_NAME.windowMs, now);
  const waits = [
    user.fails >= PER_USER.max ? user.resetAt - now : 0,
    all.fails >= PER_IP.max ? all.resetAt - now : 0,
    name.fails >= PER_NAME.max ? name.resetAt - now : 0,
  ];
  return Math.ceil(Math.max(...waits) / 1000);
}

export function recordFailure(ip: string, username: string, now = Date.now()) {
  get(`u:${ip}:${username}`, PER_USER.windowMs, now).fails++;
  get(`ip:${ip}`, PER_IP.windowMs, now).fails++;
  get(`n:${username}`, PER_NAME.windowMs, now).fails++;
}

export function recordSuccess(ip: string, username: string) {
  buckets.delete(`u:${ip}:${username}`);
}

// Drop expired entries now and then so the map can't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 10 * 60_000).unref();
