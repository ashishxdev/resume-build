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
});
