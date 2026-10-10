import {
  DEFAULT_RESUME_PRESENTATION,
  type ProfessionalResumeDocument,
} from "@make-my-resume/contracts";
import { describe, expect, it } from "vitest";

import { applyResumePresentation } from "./apply-resume-presentation.js";

const document: ProfessionalResumeDocument = {
  name: "Alex Mercer",
  headline: null,
  contact: [],
  sections: [
    {
      kind: "experience",
      title: "Experience",
      items: [
        {
          id: "experience_1",
          sourceClaimId: "claim_1",
          heading: null,
          body: "Built APIs.",
          tailored: false,
        },
      ],
    },
    {
      kind: "skills",
      title: "Skills",
      items: [
        {
          id: "skills_1",
          sourceClaimId: "claim_2",
          heading: null,
          body: "TypeScript",
          tailored: false,
        },
      ],
    },
  ],
};

describe("applyResumePresentation", () => {
  it("orders and hides sections without mutating the source document", () => {
    const result = applyResumePresentation(document, {
      ...DEFAULT_RESUME_PRESENTATION,
      sectionOrder: ["skills", "experience"],
      hiddenSections: ["experience"],
    });

    expect(result.sections.map((section) => section.kind)).toEqual(["skills"]);
    expect(document.sections.map((section) => section.kind)).toEqual([
      "experience",
      "skills",
    ]);
  });
});
