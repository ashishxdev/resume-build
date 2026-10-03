import type { ResumeClaim } from "@make-my-resume/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  createGeminiJobDescriptionAnalyzer,
  parseGroundedJobAnalysis,
} from "./gemini-job-description-analyzer.js";

const claims: ResumeClaim[] = [
  {
    id: "claim_verified",
    category: "skills",
    label: "Design systems",
    value: "Built a shared design system for four product teams.",
    sourceText: "Built a shared design system for four product teams.",
    pageNumber: 1,
    userAdded: false,
    status: "confirmed",
    order: 0,
  },
];
const rawText =
  "You will lead design systems across product teams. Five years of enterprise experience is required.";

describe("parseGroundedJobAnalysis", () => {
  it("keeps exact job evidence and verified resume links", () => {
    const analysis = parseGroundedJobAnalysis(
      JSON.stringify({
        requirements: [
          {
            key: "design-systems",
            category: "responsibility",
            priority: "required",
            label: "Lead design systems",
            sourceQuote: "lead design systems across product teams",
            matchStatus: "strong",
            resumeClaimIds: ["claim_verified"],
            explanation:
              "The verified claim directly supports design-system work.",
          },
        ],
      }),
      rawText,
      claims,
    );

    expect(analysis.requirements).toHaveLength(1);
    expect(analysis.matches[0]).toMatchObject({
      status: "strong",
      resumeClaimIds: ["claim_verified"],
    });
  });

  it("drops invented job quotes and downgrades unknown resume evidence", () => {
    const analysis = parseGroundedJobAnalysis(
      JSON.stringify({
        requirements: [
          {
            key: "invented",
            category: "skill",
            priority: "required",
            label: "React",
            sourceQuote: "Expert React knowledge",
            matchStatus: "strong",
            resumeClaimIds: ["claim_verified"],
            explanation: "Invented requirement.",
          },
          {
            key: "experience",
            category: "experience",
            priority: "required",
            label: "Five years enterprise experience",
            sourceQuote: "Five years of enterprise experience is required.",
            matchStatus: "strong",
            resumeClaimIds: ["claim_unknown"],
            explanation: "Unsupported link.",
          },
        ],
      }),
      rawText,
      claims,
    );

    expect(analysis.requirements).toHaveLength(1);
    expect(analysis.matches[0]).toMatchObject({
      status: "missing",
      resumeClaimIds: [],
    });
  });
});

describe("createGeminiJobDescriptionAnalyzer", () => {
  it("requests private structured output", async () => {
    const create = vi.fn().mockResolvedValue({
      output_text: JSON.stringify({
        requirements: [
          {
            key: "design-systems",
            category: "responsibility",
            priority: "required",
            label: "Lead design systems",
            sourceQuote: "lead design systems across product teams",
            matchStatus: "strong",
            resumeClaimIds: ["claim_verified"],
            explanation: "Direct verified evidence.",
          },
        ],
      }),
    });
    const analyzer = createGeminiJobDescriptionAnalyzer({
      apiKey: "test-key",
      model: "gemini-test",
      client: { interactions: { create } },
    });

    const result = await analyzer.analyze({ rawText, resumeClaims: claims });

    expect(result).toMatchObject({
      provider: "gemini",
      model: "gemini-test",
      promptVersion: "job-analysis-v1",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-test",
        store: false,
        response_format: expect.objectContaining({
          mime_type: "application/json",
        }),
      }),
      { timeout: 45_000, maxRetries: 0 },
    );
  });
});
