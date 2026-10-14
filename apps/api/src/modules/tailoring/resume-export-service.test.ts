import {
  DEFAULT_RESUME_PRESENTATION,
  type ProfessionalResumeDocument,
} from "@make-my-resume/contracts";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";

import {
  attachContactLinksToClaims,
  attachProjectLinksToClaims,
  renderProfessionalResume,
} from "./resume-export-service.js";

const resume: ProfessionalResumeDocument = {
  name: "Alex Mercer",
  headline: "Product Designer",
  contact: ["alex@example.com", "+1 555 867 5309"],
  sections: [
    {
      kind: "summary",
      title: "Professional Summary",
      items: [
        {
          id: "item_summary",
          sourceClaimId: "summary",
          heading: null,
          body: "Product designer focused on accessible enterprise workflows.",
          tailored: false,
        },
      ],
    },
    {
      kind: "experience",
      title: "Experience",
      items: [
        {
          id: "item_experience",
          sourceClaimId: "experience",
          heading: "Lead Product Designer at Northstar",
          body: "Led a verified design-system rollout across four products.",
          tailored: true,
        },
      ],
    },
  ],
};

describe("renderProfessionalResume", () => {
  it("creates a searchable PDF", async () => {
    const result = await renderProfessionalResume(resume, "pdf", "comfortable");
    expect(result.bytes.subarray(0, 4).toString()).toBe("%PDF");
    const loadingTask = getDocument({
      data: new Uint8Array(result.bytes),
      verbosity: 0,
    });
    const loaded = await loadingTask.promise;
    const page = await loaded.getPage(1);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => "str" in item)
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    expect(text).toContain("Alex Mercer");
    expect(text).toContain("Lead Product Designer");
    expect(text).toContain("Northstar");
    await loadingTask.destroy();
  });

  it("creates an editable DOCX with the same content", async () => {
    const result = await renderProfessionalResume(resume, "docx", {
      ...DEFAULT_RESUME_PRESENTATION,
      template: "modern",
      fontFamily: "sans",
      accentColor: "navy",
      density: "compact",
      sectionOrder: ["experience", "summary"],
      hiddenSections: ["summary"],
    });
    expect(result.bytes.subarray(0, 2).toString()).toBe("PK");
    const extracted = await mammoth.extractRawText({ buffer: result.bytes });
    expect(extracted.value).toContain("Alex Mercer");
    expect(extracted.value).toContain(
      "Led a verified design-system rollout across four products.",
    );
    expect(extracted.value).not.toContain("accessible enterprise workflows");
  });

  it("makes a project Live label clickable in PDF and DOCX exports", async () => {
    const linkedResume: ProfessionalResumeDocument = {
      ...resume,
      sections: [
        ...resume.sections,
        {
          kind: "projects",
          title: "Projects",
          items: [
            {
              id: "project",
              sourceClaimId: "project",
              heading: "Project Atlas",
              body: "Live (https://example.com/atlas) | TypeScript",
              tailored: false,
            },
          ],
        },
      ],
    };
    const pdf = await renderProfessionalResume(
      linkedResume,
      "pdf",
      "comfortable",
    );
    const loadingTask = getDocument({
      data: new Uint8Array(pdf.bytes),
      verbosity: 0,
    });
    const loaded = await loadingTask.promise;
    const annotations = await (await loaded.getPage(1)).getAnnotations();
    expect(
      annotations.some((item) => item.url === "https://example.com/atlas"),
    ).toBe(true);
    await loadingTask.destroy();

    const docx = await renderProfessionalResume(
      linkedResume,
      "docx",
      "comfortable",
    );
    const html = await mammoth.convertToHtml({ buffer: docx.bytes });
    expect(html.value).toContain('href="https://example.com/atlas"');
    expect(html.value).toContain(">Live</a>");
  });

  it("associates Live with its deployment URL when a repository URL is also present", async () => {
    const linkedResume: ProfessionalResumeDocument = {
      ...resume,
      sections: [
        {
          kind: "projects",
          title: "Projects",
          items: [
            {
              id: "project",
              sourceClaimId: "project",
              heading: "Project Atlas",
              body: "GitHub (https://github.com/example/atlas) | Live (https://atlas.example.com) | TypeScript",
              tailored: false,
            },
          ],
        },
      ],
    };

    const docx = await renderProfessionalResume(
      linkedResume,
      "docx",
      "comfortable",
    );
    const html = await mammoth.convertToHtml({ buffer: docx.bytes });
    expect(html.value).toContain(
      '<a href="https://atlas.example.com">Live</a>',
    );
    expect(html.value).toContain(
      '<a href="https://github.com/example/atlas">https://github.com/example/atlas</a>',
    );
  });

  it("does not treat an explicitly labeled repository URL as a Live deployment", async () => {
    const linkedResume: ProfessionalResumeDocument = {
      ...resume,
      sections: [
        {
          kind: "projects",
          title: "Projects",
          items: [
            {
              id: "project",
              sourceClaimId: "project",
              heading: "Project Atlas",
              body: "GitHub (https://github.com/example/atlas) | Live | TypeScript",
              tailored: false,
            },
          ],
        },
      ],
    };

    const docx = await renderProfessionalResume(
      linkedResume,
      "docx",
      "comfortable",
    );
    const html = await mammoth.convertToHtml({ buffer: docx.bytes });
    expect(html.value).toContain(
      '<a href="https://github.com/example/atlas">https://github.com/example/atlas</a>',
    );
    expect(html.value).not.toContain(
      '<a href="https://github.com/example/atlas">Live</a>',
    );
  });
});

describe("attachProjectLinksToClaims", () => {
  it("backfills a source hyperlink without mutating the stored claim", () => {
    const claim = {
      id: "project",
      category: "projects" as const,
      label: "Project",
      value: "Project Atlas | Live | TypeScript",
      sourceText:
        "Project Atlas | Live (https://example.com/atlas) | TypeScript",
      pageNumber: 1,
      status: "confirmed" as const,
      userAdded: false,
      order: 0,
    };
    const [linked] = attachProjectLinksToClaims([claim]);
    expect(linked?.value).toBe(
      "Project Atlas | Live (https://example.com/atlas) | TypeScript",
    );
    expect(claim.value).toBe("Project Atlas | Live | TypeScript");
  });

  it("restores a missing Live label for legacy AI project claims", () => {
    const claim = {
      id: "project",
      category: "projects" as const,
      label: "Interview AI",
      value:
        "Interview AI | (July 2026 - Present): Built and deployed an interview platform.",
      sourceText: "Interview AI | Live (https://example.com/interview)",
      pageNumber: 1,
      status: "confirmed" as const,
      userAdded: false,
      order: 0,
    };

    expect(attachProjectLinksToClaims([claim])[0]?.value).toBe(
      "Interview AI | Live (https://example.com/interview) | (July 2026 - Present): Built and deployed an interview platform.",
    );
  });

  it("does not restore a project link after an explicit edit removes it", () => {
    const claim = {
      id: "project-stable-id",
      category: "projects" as const,
      label: "Project Atlas",
      value: "Project Atlas | TypeScript",
      sourceText:
        "Project Atlas | Live (https://example.com/atlas) | TypeScript",
      pageNumber: 1,
      status: "edited" as const,
      userAdded: false,
      order: 0,
    };

    expect(attachProjectLinksToClaims([claim])[0]?.value).toBe(claim.value);
  });

  it("never assigns one project's source link to another claim", () => {
    const claims = [
      {
        id: "project-two",
        category: "projects" as const,
        label: "Project Two",
        value: "Project Two | Live | TypeScript",
        sourceText: "Project Two | Live | TypeScript",
        pageNumber: 1,
        status: "confirmed" as const,
        userAdded: false,
        order: 0,
      },
    ];

    expect(attachProjectLinksToClaims(claims)[0]?.value).toBe(
      "Project Two | Live | TypeScript",
    );
  });
});

describe("attachContactLinksToClaims", () => {
  it("backfills named source contact links without changing stored claims", () => {
    const claim = {
      id: "personal",
      category: "personal_info" as const,
      label: "Contact information",
      value: "Alex Mercer | alex@example.com",
      sourceText:
        "Alex Mercer | LinkedIn (https://linkedin.com/in/alex) | GitHub (https://github.com/alex)",
      pageNumber: 1,
      status: "confirmed" as const,
      userAdded: false,
      order: 0,
    };

    const [linked] = attachContactLinksToClaims([claim]);

    expect(linked?.value).toContain("LinkedIn (https://linkedin.com/in/alex)");
    expect(linked?.value).toContain("GitHub (https://github.com/alex)");
    expect(claim.value).toBe("Alex Mercer | alex@example.com");
  });

  it("preserves an explicit contact-link removal", () => {
    const claim = {
      id: "personal-stable-id",
      category: "personal_info" as const,
      label: "Contact information",
      value: "Alex Mercer | alex@example.com",
      sourceText:
        "Alex Mercer | alex@example.com | LinkedIn (https://linkedin.com/in/alex)",
      pageNumber: 1,
      status: "edited" as const,
      userAdded: false,
      order: 0,
    };

    expect(attachContactLinksToClaims([claim])[0]?.value).toBe(claim.value);
  });
});
