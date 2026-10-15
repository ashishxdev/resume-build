import type {
  JobDescriptionAnalysis,
  ResumeClaim,
} from "@make-my-resume/contracts";
import { describe, expect, it } from "vitest";

import {
  buildDeterministicTailoringSuggestions,
  buildTailoringTargets,
  parseGroundedTailoringSuggestions,
} from "./gemini-tailoring-generator.js";

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
            targetId: `target_${claim.id}`,
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
              targetId: `target_${claim.id}`,
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

  it("creates one job-specific target for all claims belonging to a project", () => {
    const projectClaims: ResumeClaim[] = [
      {
        ...claim,
        id: "project_header",
        category: "projects",
        value:
          "Interview AI | Live (https://example.com) | July 2026 – Present",
        order: 0,
      },
      {
        ...claim,
        id: "project_bullet_1",
        category: "projects",
        value: "Built an AI voice interview platform using React.",
        order: 1,
      },
      {
        ...claim,
        id: "project_bullet_2",
        category: "projects",
        value: "Integrated Gemini API for candidate evaluation.",
        order: 2,
      },
    ];
    const projectAnalysis: JobDescriptionAnalysis = {
      summary: "Project match.",
      requirements: [
        {
          id: "req_project",
          category: "skill",
          priority: "required",
          label: "Gemini API",
          sourceQuote: "Gemini API",
        },
      ],
      matches: [
        {
          requirementId: "req_project",
          status: "strong",
          resumeClaimIds: ["project_bullet_2"],
          explanation: "Direct evidence.",
        },
      ],
    };
    const input = {
      rawJobDescription: "Experience with Gemini API is required.",
      analysis: projectAnalysis,
      evidenceClaims: projectClaims,
    };
    const targets = buildTailoringTargets(input);

    expect(targets).toEqual([
      expect.objectContaining({
        id: "target_project_header",
        sourceClaimIds: [
          "project_header",
          "project_bullet_1",
          "project_bullet_2",
        ],
        originalText: expect.stringContaining("Integrated Gemini API"),
      }),
    ]);

    const suggestions = parseGroundedTailoringSuggestions(
      JSON.stringify({
        suggestions: [
          {
            targetId: "target_project_header",
            requirementIds: ["req_project"],
            suggestedText:
              "Interview AI | Live (https://example.com) | July 2026 – Present\nIntegrated Gemini API for candidate evaluation.\nBuilt an AI voice interview platform using React.",
            reason:
              "Moves the verified Gemini API work first for this job description.",
          },
        ],
      }),
      input,
    );
    expect(suggestions[0]).toMatchObject({
      sourceClaimId: "project_header",
      sourceClaimIds: [
        "project_header",
        "project_bullet_1",
        "project_bullet_2",
      ],
      section: "projects",
    });

    const fallback = buildDeterministicTailoringSuggestions(input);
    expect(fallback[0]).toMatchObject({
      sourceClaimIds: [
        "project_header",
        "project_bullet_1",
        "project_bullet_2",
      ],
      suggestedText: expect.stringMatching(
        /Integrated Gemini API[\s\S]*Built an AI voice interview platform/,
      ),
    });
  });
});
