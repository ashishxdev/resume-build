import { describe, expect, it } from "vitest";

import { parseResumeClaims } from "./structured-resume-parser.js";

describe("parseResumeClaims", () => {
  it("classifies headings and preserves source pages", () => {
    const claims = parseResumeClaims([
      {
        pageNumber: 1,
        text: "Alex Mercer\nalex@example.com\nSummary\nProduct designer focused on systems.\nExperience\nLed a design system rollout.",
      },
      { pageNumber: 2, text: "Skills\nFigma, research, facilitation" },
    ]);

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "summary",
          pageNumber: 1,
          sourceText: "Product designer focused on systems.",
        }),
        expect.objectContaining({ category: "experience", pageNumber: 1 }),
        expect.objectContaining({ category: "skills", pageNumber: 2 }),
      ]),
    );
    expect(claims.every((claim) => claim.status === "unreviewed")).toBe(true);
  });

  it("groups fallback extraction into coherent resume records", () => {
    const claims = parseResumeClaims([
      {
        pageNumber: 1,
        text: [
          "Alex Mercer",
          "alex@example.com",
          "Professional Summary",
          "Full Stack Engineer building",
          "reliable production applications.",
          "Experience",
          "Software Engineer May 2024 – Present",
          "Acme Remote",
          "Built an internal platform.",
          "Improved reliability by 30%.",
          "Skills",
          "Languages: TypeScript, SQL",
          "Frontend: React, Next.js",
          "Projects",
          "Interview AI | Live (https://example.com) | July 2026 – Present",
          "Built an AI interview platform.",
          "MyJEEPredictor | Live (https://jee.example.com) | March 2026 – Present",
          "Built a college prediction platform.",
        ].join("\n"),
      },
    ]);

    expect(
      claims.filter((claim) => claim.category === "personal_info"),
    ).toHaveLength(1);
    expect(claims.filter((claim) => claim.category === "summary")).toEqual([
      expect.objectContaining({
        value:
          "Full Stack Engineer building\nreliable production applications.",
      }),
    ]);
    expect(claims.filter((claim) => claim.category === "experience")).toEqual([
      expect.objectContaining({
        value: expect.stringContaining("Improved reliability by 30%."),
      }),
    ]);
    expect(claims.filter((claim) => claim.category === "skills")).toHaveLength(
      1,
    );
    expect(claims.filter((claim) => claim.category === "projects")).toEqual([
      expect.objectContaining({
        value: expect.stringContaining("Built an AI interview platform."),
      }),
      expect.objectContaining({
        value: expect.stringContaining("Built a college prediction platform."),
      }),
    ]);
  });
});
