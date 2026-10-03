import type {
  JobDescriptionAnalysis,
  ResumeClaim,
} from "@make-my-resume/contracts";
import { describe, expect, it } from "vitest";

import { parseGroundedTailoringSuggestions } from "./gemini-tailoring-generator.js";

const claim: ResumeClaim = {
  id: "claim_1",
  category: "experience",
  label: "Platform work",
  value: "Built APIs using Node.js and Express across 4 products.",
  sourceText: "Built APIs using Node.js and Express across 4 products.",
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
      label: "Build REST APIs",
      sourceQuote: "Build REST APIs",
    },
  ],
  matches: [
    {
      requirementId: "req_1",
      status: "strong",
      resumeClaimIds: [claim.id],
      explanation: "Direct evidence.",
    },
  ],
};

describe("grounded tailoring suggestions", () => {
  it("binds a conservative suggestion to verified evidence", () => {
    const suggestions = parseGroundedTailoringSuggestions(
      JSON.stringify({
        suggestions: [
          {
            sourceClaimId: claim.id,
            requirementIds: ["req_1"],
            suggestedText:
              "Built REST APIs using Node.js and Express across 4 products.",
            reason: "Makes the verified API work easier to find.",
          },
        ],
      }),
      {
        rawJobDescription: "Build REST APIs",
        analysis,
        evidenceClaims: [claim],
      },
    );
    expect(suggestions[0]).toMatchObject({
      sourceClaimId: claim.id,
      status: "pending",
      originalText: claim.value,
    });
  });

  it("rejects invented metrics and unlinked requirements", () => {
    expect(() =>
      parseGroundedTailoringSuggestions(
        JSON.stringify({
          suggestions: [
            {
              sourceClaimId: claim.id,
              requirementIds: ["req_1"],
              suggestedText: "Built REST APIs across 12 products.",
              reason: "Stronger result.",
            },
          ],
        }),
        {
          rawJobDescription: "Build REST APIs",
          analysis,
          evidenceClaims: [claim],
        },
      ),
    ).toThrow("AI_UNGROUNDED_SUGGESTIONS");
  });
});
