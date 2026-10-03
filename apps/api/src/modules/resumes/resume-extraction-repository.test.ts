import type { ResumeClaim } from "@make-my-resume/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryResumeExtractionRepository,
  extractionProcessingLeaseMilliseconds,
} from "./resume-extraction-repository.js";

const input = {
  userId: "user_1",
  resumeId: "resume_1",
  importId: "import_1",
  objectKey: "users/user_1/resume.pdf",
  mimeType: "application/pdf" as const,
};

const claims: ResumeClaim[] = [
  {
    id: "claim_1",
    category: "experience",
    label: "Experience",
    value: "Built a design system",
    sourceText: "Built a design system",
    pageNumber: 1,
    status: "unreviewed",
    userAdded: false,
    order: 0,
  },
];

afterEach(() => {
  vi.useRealTimers();
});

describe("resume extraction repository", () => {
  it("creates only one job for concurrent requests for the same resume", async () => {
    const repository = createMemoryResumeExtractionRepository();

    const [first, second] = await Promise.all([
      repository.createQueued(input),
      repository.createQueued(input),
    ]);

    expect(second.id).toBe(first.id);
    await expect(
      repository.findManyOwned(input.userId, [input.resumeId]),
    ).resolves.toHaveLength(1);
  });

  it("reclaims an expired lease and rejects completion by the stale worker", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z"));
    const repository = createMemoryResumeExtractionRepository();
    const queued = await repository.createQueued(input);
    const firstClaim = await repository.claimNext();

    vi.advanceTimersByTime(extractionProcessingLeaseMilliseconds + 1);
    const reclaimed = await repository.claimNext();

    expect(reclaimed).toMatchObject({ id: queued.id, attempts: 2 });
    expect(reclaimed?.processingToken).not.toBe(firstClaim?.processingToken);
    await expect(
      repository.complete(queued.id, firstClaim!.processingToken!, claims),
    ).resolves.toBeNull();
    await expect(
      repository.complete(queued.id, reclaimed!.processingToken!, claims),
    ).resolves.toMatchObject({ status: "review_required" });
  });

  it("moves an repeatedly abandoned job to a terminal failure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z"));
    const repository = createMemoryResumeExtractionRepository();
    await repository.createQueued(input);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(repository.claimNext()).resolves.toMatchObject({
        status: "processing",
        attempts: attempt + 1,
      });
      vi.advanceTimersByTime(extractionProcessingLeaseMilliseconds + 1);
    }

    await expect(repository.claimNext()).resolves.toBeNull();
    await expect(
      repository.findOwned(input.userId, input.resumeId),
    ).resolves.toMatchObject({
      status: "failed",
      processingToken: null,
      processingLeaseExpiresAt: null,
    });
  });

  it("uses an optimistic revision to reject concurrent verification saves", async () => {
    const repository = createMemoryResumeExtractionRepository();
    const queued = await repository.createQueued(input);
    const claimed = await repository.claimNext();
    const ready = await repository.complete(
      queued.id,
      claimed!.processingToken!,
      claims,
    );
    const reviewedClaims = claims.map((claim) => ({
      ...claim,
      status: "confirmed" as const,
    }));

    const first = await repository.updateClaims(
      input.userId,
      input.resumeId,
      reviewedClaims,
      ready!.revision,
    );
    const stale = await repository.updateClaims(
      input.userId,
      input.resumeId,
      reviewedClaims,
      ready!.revision,
    );

    expect(first).toMatchObject({ status: "verified" });
    expect(stale).toBeNull();
  });
});
