import type { ResumeClaim } from "@make-my-resume/contracts";
import { describe, expect, it } from "vitest";

import { buildProfessionalResumeDocument } from "./build-professional-resume.js";

const claims: ResumeClaim[] = [
  {
    id: "personal",
    category: "personal_info",
    label: "Contact information",
    value:
      "Name: Alex Mercer | alex@example.com | +1 555 867 5309 | Bengaluru, India",
    sourceText: null,
    pageNumber: 1,
    status: "confirmed",
    userAdded: false,
    order: 0,
  },
  {
    id: "summary",
    category: "summary",
    label: "Professional Summary",
    value: "Product designer focused on accessible enterprise workflows.",
    sourceText: null,
    pageNumber: 1,
    status: "confirmed",
    userAdded: false,
    order: 1,
  },
  {
    id: "experience",
    category: "experience",
    label: "Lead Product Designer at Northstar",
    value: "Led a verified design-system rollout across four products.",
    sourceText: null,
    pageNumber: 1,
    status: "edited",
    userAdded: false,
    order: 2,
  },
];

describe("buildProfessionalResumeDocument", () => {
  it("builds an ordered, evidence-preserving professional document", () => {
    const document = buildProfessionalResumeDocument(claims, {
      tailoredClaimIds: ["experience"],
    });

    expect(document.name).toBe("Alex Mercer");
    expect(document.contact).toEqual([
      "alex@example.com",
      "+1 555 867 5309",
      "Bengaluru, India",
    ]);
    expect(document.sections.map((section) => section.kind)).toEqual([
      "summary",
      "experience",
    ]);
    expect(document.sections[1]?.items[0]).toMatchObject({
      heading: "Lead Product Designer at Northstar",
      tailored: true,
    });
  });

  it("omits rejected claims and uses a neutral title when no name exists", () => {
    const document = buildProfessionalResumeDocument([
      { ...claims[1]!, status: "rejected" },
    ]);
    expect(document.name).toBe("Professional Resume");
    expect(document.sections).toEqual([]);
  });

  it("restores line structure for grouped skills and projects", () => {
    const document = buildProfessionalResumeDocument([
      {
        ...claims[1]!,
        id: "skills",
        category: "skills",
        label: "Technical Skills",
        value:
          "Languages: JavaScript, TypeScript, SQL; Frontend: React.js, Next.js, Tailwind CSS; Backend: Node.js, Express.js, REST APIs",
      },
      {
        ...claims[1]!,
        id: "project",
        category: "projects",
        label: "MyJEEPredictor",
        order: 2,
        value:
          "MyJEEPredictor | Live | Next.js, TypeScript, PostgreSQL (March 2026 - Present). Built and deployed a full-stack JEE prediction platform. Processed and analyzed 1,000+ cutoff records. Developed 4 prediction tools.",
      },
    ]);

    expect(document.sections[0]?.items[0]?.body).toBe(
      "Languages: JavaScript, TypeScript, SQL\nFrontend: React.js, Next.js, Tailwind CSS\nBackend: Node.js, Express.js, REST APIs",
    );
    expect(document.sections[1]?.items[0]).toMatchObject({
      heading: "MyJEEPredictor",
      body: "Live | Next.js, TypeScript, PostgreSQL (March 2026 - Present).\n- Built and deployed a full-stack JEE prediction platform.\n- Processed and analyzed 1,000+ cutoff records.\n- Developed 4 prediction tools.",
    });
  });
});
