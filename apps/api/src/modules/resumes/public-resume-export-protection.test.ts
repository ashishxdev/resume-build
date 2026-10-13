import { describe, expect, it, vi } from "vitest";

import {
  createMemoryPublicResumeExportCache,
  createMemoryPublicResumeExportRateLimiter,
  publicResumeExportRequestsPerMinute,
} from "./public-resume-export-protection.js";

describe("public resume export protection", () => {
  it("limits repeated downloads by share token and client IP", () => {
    const limiter = createMemoryPublicResumeExportRateLimiter();
    for (
      let request = 0;
      request < publicResumeExportRequestsPerMinute;
      request += 1
    ) {
      expect(limiter.consume("share-token", "192.0.2.1").allowed).toBe(true);
    }
    const denied = limiter.consume("share-token", "192.0.2.1");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSeconds).toBeGreaterThan(0);
    expect(limiter.consume("share-token", "192.0.2.2").allowed).toBe(true);
  });

  it("caches completed exports and coalesces concurrent renders", async () => {
    const cache = createMemoryPublicResumeExportCache();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const render = vi.fn(async () => {
      await pending;
      return {
        bytes: Uint8Array.from([1, 2, 3]),
        contentType: "application/pdf",
        extension: "pdf" as const,
      };
    });

    const first = cache.getOrCreate("version_1:revision_1", render);
    const concurrent = cache.getOrCreate("version_1:revision_1", render);
    finish();
    expect(await first).toEqual(await concurrent);
    await cache.getOrCreate("version_1:revision_1", render);
    expect(render).toHaveBeenCalledTimes(1);
  });
});
