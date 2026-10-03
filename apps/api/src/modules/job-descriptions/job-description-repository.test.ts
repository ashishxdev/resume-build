import type { ResumeClaim } from "@make-my-resume/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMemoryJobDescriptionRepository,
  jobAnalysisLeaseMilliseconds,
  JobAnalysisConcurrencyError,
} from "./job-description-repository.js";

const claim: ResumeClaim = {
  id: "claim_1",
  category: "skills",
  label: "Design systems",
  value: "Led a verified design system.",
  sourceText: "Led a verified design system.",
  pageNumber: 1,
  userAdded: false,
  status: "confirmed",
  order: 0,
};

function input(userId = "user_1") {
  return {
    userId,
    resumeId: "resume_1",
    resumeVersionId: "version_1",
    evidenceClaims: [claim],
    rawText:
      "A sufficiently long job description that is stored as the source of truth.",
  };
}

describe("memory job description repository", () => {
  afterEach(() => vi.useRealTimers());

  it("queues work, preserves immutable evidence, and rejects stale workers", async () => {
    const repository = createMemoryJobDescriptionRepository();
    const source = input();
    const created = await repository.create(source);
    source.evidenceClaims[0]!.value = "Changed after creation";
    expect(created).toMatchObject({ status: "queued", attempts: 0 });
    expect(created.evidenceClaims[0]?.value).toBe(
      "Led a verified design system.",
    );

    const claimed = await repository.claimNext();
    expect(claimed).toMatchObject({ status: "analyzing", attempts: 1 });
    expect(
      await repository.complete(claimed!.id, "wrong-token", {
        analysis: { summary: "Summary", requirements: [], matches: [] },
        provider: "gemini",
        model: "gemini-test",
        promptVersion: "job-analysis-v1",
      }),
    ).toBeNull();
    const failed = await repository.fail(
      claimed!.id,
      claimed!.processingToken!,
      "Try again.",
    );
    expect(failed).toMatchObject({ status: "failed" });
    const queued = await repository.retry(
      "user_1",
      created.id,
      failed!.revision,
    );
    expect(queued).toMatchObject({ status: "queued", attempts: 0 });
  });

  it("reclaims an expired processing lease after a worker exits", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T00:00:00.000Z"));
    const repository = createMemoryJobDescriptionRepository();
    await repository.create(input());
    const first = await repository.claimNext();

    vi.setSystemTime(new Date(Date.now() + jobAnalysisLeaseMilliseconds + 1));
    const reclaimed = await repository.claimNext();

    expect(reclaimed).toMatchObject({ id: first!.id, attempts: 2 });
    expect(reclaimed!.processingToken).not.toBe(first!.processingToken);
  });

  it("allows only one queued or processing analysis per user", async () => {
    const repository = createMemoryJobDescriptionRepository();
    await repository.create(input());
    await expect(
      repository.create({ ...input(), resumeId: "resume_2" }),
    ).rejects.toBeInstanceOf(JobAnalysisConcurrencyError);
    await expect(repository.create(input("user_2"))).resolves.toBeTruthy();
  });

  it("does not expose another user's record", async () => {
    const repository = createMemoryJobDescriptionRepository();
    const created = await repository.create(input());
    expect(await repository.findOwned("user_2", created.id)).toBeNull();
  });
});
