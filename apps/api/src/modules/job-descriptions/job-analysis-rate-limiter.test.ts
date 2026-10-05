import { describe, expect, it } from "vitest";

import {
  createMemoryJobAnalysisRateLimiter,
  jobAnalysisRequestsPerHour,
} from "./job-analysis-rate-limiter.js";

describe("job analysis rate limiter", () => {
  it("enforces a per-user hourly quota and isolates users", async () => {
    const limiter = createMemoryJobAnalysisRateLimiter();
    const now = new Date("2026-10-03T00:10:00.000Z");
    for (let index = 0; index < jobAnalysisRequestsPerHour; index += 1) {
      await expect(limiter.consume("user_1", now)).resolves.toMatchObject({
        allowed: true,
      });
    }
    await expect(limiter.consume("user_1", now)).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 3_000,
    });
    await expect(limiter.consume("user_2", now)).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("opens a fresh bucket in the next hour", async () => {
    const limiter = createMemoryJobAnalysisRateLimiter();
    const firstHour = new Date("2026-10-03T00:59:59.000Z");
    for (let index = 0; index <= jobAnalysisRequestsPerHour; index += 1) {
      await limiter.consume("user_1", firstHour);
    }
    await expect(
      limiter.consume("user_1", new Date("2026-10-03T01:00:00.000Z")),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("charges an operation id only once within a window", async () => {
    const limiter = createMemoryJobAnalysisRateLimiter();
    const now = new Date("2026-10-03T00:10:00.000Z");
    await limiter.consume("user_1", now, "ats-improvement:session_1");
    await limiter.consume("user_1", now, "ats-improvement:session_1");
    for (let index = 1; index < jobAnalysisRequestsPerHour; index += 1) {
      await expect(
        limiter.consume("user_1", now, `operation_${index}`),
      ).resolves.toMatchObject({ allowed: true });
    }
    await expect(
      limiter.consume("user_1", now, "operation_over_limit"),
    ).resolves.toMatchObject({ allowed: false });
  });
});
