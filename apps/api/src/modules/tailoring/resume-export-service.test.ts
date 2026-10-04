import type { ProfessionalResumeDocument } from "@make-my-resume/contracts";
import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";

import { renderProfessionalResume } from "./resume-export-service.js";

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
    expect(text).toContain("Lead Product Designer at Northstar");
    await loadingTask.destroy();
  });

  it("creates an editable DOCX with the same content", async () => {
    const result = await renderProfessionalResume(resume, "docx", "compact");
    expect(result.bytes.subarray(0, 2).toString()).toBe("PK");
    const extracted = await mammoth.extractRawText({ buffer: result.bytes });
    expect(extracted.value).toContain("Alex Mercer");
    expect(extracted.value).toContain(
      "Led a verified design-system rollout across four products.",
    );
  });
});
