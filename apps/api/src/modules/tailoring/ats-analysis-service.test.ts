import type { TailoringSessionRecord } from "./tailoring-repository.js";
import { describe, expect, it } from "vitest";

import { analyzeAts } from "./ats-analysis-service.js";

const record = {
  id: "tailor_1",
  userId: "user_1",
  jobDescriptionId: "jd_1",
  resumeId: "resume_1",
  resumeVersionId: "version_1",
  role: "Engineer",
  company: "Acme",
  rawJobDescription: "Build TypeScript APIs and mentor engineers.",
  analysis: {
    summary: "Two requirements.",
    requirements: [
      {
        id: "req_1",
        category: "skill",
        priority: "required",
        label: "TypeScript",
        sourceQuote: "TypeScript APIs",
      },
      {
        id: "req_2",
        category: "responsibility",
        priority: "preferred",
        label: "Mentoring",
        sourceQuote: "mentor engineers",
      },
    ],
    matches: [
      {
        requirementId: "req_1",
        status: "strong",
        resumeClaimIds: ["claim_1"],
        explanation: "Direct.",
      },
      {
        requirementId: "req_2",
        status: "missing",
        resumeClaimIds: [],
        explanation: "Missing.",
      },
    ],
  },
  evidenceClaims: [],
  status: "completed",
  failureMessage: null,
  suggestions: [],
  finalClaims: [
    {
      id: "claim_1",
      category: "skills",
      label: "TypeScript",
      value: "Built TypeScript APIs for production services.",
      sourceText: "Built TypeScript APIs for production services.",
      pageNumber: 1,
      status: "confirmed",
      userAdded: false,
      order: 0,
    },
    {
      id: "claim_2",
      category: "experience",
      label: "Delivery",
      value: "Delivered reliable customer-facing software releases.",
      sourceText: "Delivered reliable customer-facing software releases.",
      pageNumber: 1,
      status: "confirmed",
      userAdded: false,
      order: 1,
    },
    {
      id: "claim_3",
      category: "education",
      label: "Degree",
      value: "Bachelor of Engineering in Computer Science.",
      sourceText: "Bachelor of Engineering in Computer Science.",
      pageNumber: 1,
      status: "confirmed",
      userAdded: false,
      order: 2,
    },
  ],
  tailoredVersionId: "version_tailored",
  provider: "gemini",
  model: "test",
  promptVersion: "v1",
  attempts: 1,
  processingToken: null,
  processingLeaseExpiresAt: null,
  revision: 2,
  atsStatus: "analyzing",
  atsFailureMessage: null,
  atsSnapshot: null,
  atsAttempts: 1,
  atsProcessingToken: "lease_1",
  atsLeaseExpiresAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} satisfies TailoringSessionRecord;

describe("ATS analysis", () => {
  it("scores the bound tailored version and keeps unsupported requirements missing", () => {
    const snapshot = analyzeAts(record);
    expect(snapshot.tailoredVersionId).toBe("version_tailored");
    expect(snapshot.categories).toHaveLength(6);
    expect(snapshot.overallScore).toBeGreaterThan(0);
    expect(
      snapshot.findings.find((item) => item.title === "TypeScript")?.type,
    ).toBe("strength");
    const missing = snapshot.findings.find(
      (item) => item.title === "Mentoring",
    );
    expect(missing?.type).toBe("missing");
    expect(missing?.resumeClaimIds).toEqual([]);
    expect(missing?.explanation).toMatch(/will not be invented/i);
  });

  it("matches complete keyword tokens instead of substrings", () => {
    const snapshot = analyzeAts({
      ...record,
      analysis: {
        summary: "Exact technology requirements.",
        requirements: [
          {
            id: "req_java",
            category: "skill",
            priority: "required",
            label: "Java",
            sourceQuote: "Java",
          },
          {
            id: "req_sql",
            category: "skill",
            priority: "required",
            label: "SQL",
            sourceQuote: "SQL",
          },
        ],
        matches: [],
      },
      finalClaims: [
        {
          ...record.finalClaims[0]!,
          label: "JavaScript and NoSQL",
          value: "Built JavaScript services backed by a NoSQL database.",
        },
      ],
    });
    expect(
      snapshot.categories.find((item) => item.category === "keyword_coverage")
        ?.score,
    ).toBe(0);
  });

  it("normalizes C#, C++, and .NET technology tokens", () => {
    const snapshot = analyzeAts({
      ...record,
      analysis: {
        summary: "Special technology requirements.",
        requirements: [
          {
            id: "req_special",
            category: "skill",
            priority: "required",
            label: "C#, C++, and .NET",
            sourceQuote: "C#, C++, and .NET",
          },
        ],
        matches: [],
      },
      finalClaims: [
        {
          ...record.finalClaims[0]!,
          label: "Platform engineering",
          value: "Developed services with C sharp, C plus plus, and ASP.NET.",
        },
      ],
    });
    expect(
      snapshot.categories.find((item) => item.category === "keyword_coverage")
        ?.score,
    ).toBe(100);
  });
});
