import type { ResumeExportResult } from "../tailoring/resume-export-service.js";

export interface PublicResumeExportRateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface PublicResumeExportRateLimiter {
  consume(
    shareToken: string,
    clientIp: string,
  ): PublicResumeExportRateLimitResult;
}

export interface PublicResumeExportCache {
  getOrCreate(
    versionKey: string,
    create: () => Promise<ResumeExportResult>,
  ): Promise<ResumeExportResult>;
}

export const publicResumeExportRequestsPerMinute = 20;
const rateLimitWindowMilliseconds = 60_000;
const cacheTtlMilliseconds = 10 * 60_000;
const maximumCacheEntries = 100;
const maximumCachedBytes = 50 * 1024 * 1024;

export function createMemoryPublicResumeExportRateLimiter(): PublicResumeExportRateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    consume(shareToken, clientIp) {
      const now = Date.now();
      const key = `${shareToken}:${clientIp}`;
      let window = windows.get(key);
      if (!window || window.resetAt <= now) {
        window = { count: 0, resetAt: now + rateLimitWindowMilliseconds };
        windows.set(key, window);
      }
      window.count += 1;

      if (windows.size > 1_000) {
        for (const [candidateKey, candidate] of windows) {
          if (candidate.resetAt <= now) windows.delete(candidateKey);
        }
        while (windows.size > 1_000) {
          const oldestKey = windows.keys().next().value as string | undefined;
          if (!oldestKey) break;
          windows.delete(oldestKey);
        }
      }

      return {
        allowed: window.count <= publicResumeExportRequestsPerMinute,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((window.resetAt - now) / 1_000),
        ),
      };
    },
  };
}

export function createMemoryPublicResumeExportCache(): PublicResumeExportCache {
  const cache = new Map<
    string,
    { result: ResumeExportResult; expiresAt: number; size: number }
  >();
  const inFlight = new Map<string, Promise<ResumeExportResult>>();
  let cachedBytes = 0;

  function remove(key: string) {
    const existing = cache.get(key);
    if (!existing) return;
    cachedBytes -= existing.size;
    cache.delete(key);
  }

  function prune(now: number) {
    for (const [key, entry] of cache) {
      if (entry.expiresAt <= now) remove(key);
    }
    while (
      cache.size > maximumCacheEntries ||
      cachedBytes > maximumCachedBytes
    ) {
      const oldestKey = cache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      remove(oldestKey);
    }
  }

  return {
    async getOrCreate(versionKey, create) {
      const now = Date.now();
      prune(now);
      const cached = cache.get(versionKey);
      if (cached && cached.expiresAt > now) return cached.result;

      const existing = inFlight.get(versionKey);
      if (existing) return existing;

      const pending = create()
        .then((result) => {
          const size = result.bytes.byteLength;
          if (size <= maximumCachedBytes) {
            remove(versionKey);
            cache.set(versionKey, {
              result,
              expiresAt: Date.now() + cacheTtlMilliseconds,
              size,
            });
            cachedBytes += size;
            prune(Date.now());
          }
          return result;
        })
        .finally(() => inFlight.delete(versionKey));
      inFlight.set(versionKey, pending);
      return pending;
    },
  };
}
