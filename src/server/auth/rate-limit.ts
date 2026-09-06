const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type Bucket = {
  count: number;
  resetAt: number;
};

export function createLoginRateLimiter() {
  const buckets = new Map<string, Bucket>();

  function current(ip: string, now: number): Bucket | undefined {
    const bucket = buckets.get(ip);
    if (!bucket) {
      return undefined;
    }
    if (now >= bucket.resetAt) {
      buckets.delete(ip);
      return undefined;
    }
    return bucket;
  }

  return {
    isBlocked(ip: string, now = Date.now()): boolean {
      const bucket = current(ip, now);
      return Boolean(bucket && bucket.count >= MAX_FAILURES);
    },
    recordFailure(ip: string, now = Date.now()): void {
      const bucket = current(ip, now);
      if (!bucket) {
        buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return;
      }
      bucket.count += 1;
    },
    reset(ip: string): void {
      buckets.delete(ip);
    },
  };
}

export type LoginRateLimiter = ReturnType<typeof createLoginRateLimiter>;
