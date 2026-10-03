import type {
  JobDescriptionAnalysis,
  ResumeClaim,
  TailoringSuggestion,
} from "@make-my-resume/contracts";
import { describe, expect, it } from "vitest";

import { createMemoryTailoringRepository } from "./tailoring-repository.js";

const claim: ResumeClaim = {
  id: "claim_1",
  category: "experience",
  label: "APIs",
  value: "Built APIs with Node.js.",
  sourceText: "Built APIs with Node.js.",
  pageNumber: 1,
  status: "confirmed",
  userAdded: false,
  order: 0,
};
const analysis: JobDescriptionAnalysis = {
  summary: "One requirement.",
  requirements: [
    {
      id: "req_1",
      category: "responsibility",
      priority: "required",
      label: "REST APIs",
      sourceQuote: "REST APIs",
    },
  ],
  matches: [
    {
      requirementId: "req_1",
      status: "strong",
      resumeClaimIds: [claim.id],
      explanation: "Direct.",
    },
  ],
};
const suggestion: TailoringSuggestion = {
  id: "suggestion_1",
  sourceClaimId: claim.id,
  requirementIds: ["req_1"],
  section: "experience",
  originalText: claim.value,
  suggestedText: "Built REST APIs with Node.js.",
  reason: "Relevant wording.",
  status: "pending",
  editedText: null,
};

describe("tailoring repository", () => {
  it("persists decisions and creates a separate tailored version", async () => {
    const repository = createMemoryTailoringRepository();
    const created = await repository.create({
      userId: "user_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_base",
      role: "Engineer",
      company: "Acme",
      rawJobDescription: "REST APIs",
      analysis,
      evidenceClaims: [claim],
    });
    const claimed = await repository.claimNext();
    const review = await repository.generated(
      created.id,
      claimed!.processingToken!,
      {
        suggestions: [suggestion],
        provider: "gemini",
        model: "test",
        promptVersion: "v1",
      },
    );
    const decided = await repository.decide(
      "user_1",
      created.id,
      suggestion.id,
      review!.revision,
      {
        status: "accepted",
        editedText: "Built accessible REST APIs with Node.js.",
      },
    );
    const completed = await repository.complete(
      "user_1",
      created.id,
      decided!.revision,
    );
    expect(completed).toMatchObject({
      status: "completed",
      resumeVersionId: "version_base",
    });
    expect(completed!.tailoredVersionId).toMatch(/^version_/);
    expect(completed!.finalClaims?.[0]?.value).toBe(
      "Built accessible REST APIs with Node.js.",
    );
    expect(claim.value).toBe("Built APIs with Node.js.");
  });

  it("will not complete while a decision is pending", async () => {
    const repository = createMemoryTailoringRepository();
    const created = await repository.create({
      userId: "user_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: null,
      company: null,
      rawJobDescription: "REST APIs",
      analysis,
      evidenceClaims: [claim],
    });
    const claimed = await repository.claimNext();
    const review = await repository.generated(
      created.id,
      claimed!.processingToken!,
      {
        suggestions: [suggestion],
        provider: "gemini",
        model: "test",
        promptVersion: "v1",
      },
    );
    await expect(
      repository.complete("user_1", created.id, review!.revision),
    ).resolves.toBeNull();
  });
});
