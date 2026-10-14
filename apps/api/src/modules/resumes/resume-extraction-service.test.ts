import { describe, expect, it, vi } from "vitest";

import {
  noReadableDocumentFailureMessage,
  parseExtractedResume,
  scannedPdfFailureMessage,
} from "./resume-extraction-service.js";

const pages = [
  {
    pageNumber: 1,
    text: "Summary\nProduct designer\nExperience\nSenior Designer at Acme",
  },
];

describe("parseExtractedResume", () => {
  it("uses grounded AI claims when the provider succeeds", async () => {
    const claims = [
      {
        id: "claim_ai",
        category: "experience" as const,
        label: "Experience",
        value: "Senior Designer at Acme",
        sourceText: "Senior Designer at Acme",
        pageNumber: 1,
        status: "unreviewed" as const,
        userAdded: false,
        order: 0,
      },
    ];
    const result = await parseExtractedResume(pages, {
      parse: vi.fn().mockResolvedValue({
        claims,
        provider: "gemini",
        model: "gemini-test-model",
        promptVersion: "resume-structure-v1",
      }),
    });

    expect(result).toMatchObject({ parsingMode: "ai", claims });
  });

  it("falls back to deterministic parsing when the provider fails", async () => {
    const result = await parseExtractedResume(pages, {
      parse: vi.fn().mockRejectedValue(new Error("provider unavailable")),
    });

    expect(result.parsingMode).toBe("deterministic_fallback");
    expect(result.claims).toHaveLength(2);
    expect(result.claims.map((claim) => claim.category)).toEqual([
      "summary",
      "experience",
    ]);
  });
});

describe("noReadableDocumentFailureMessage", () => {
  it("explains that scanned or flattened PDFs need a different source file", () => {
    expect(noReadableDocumentFailureMessage("application/pdf")).toBe(
      scannedPdfFailureMessage,
    );
    expect(scannedPdfFailureMessage).toContain("scanned or flattened");
    expect(scannedPdfFailureMessage).toContain("no selectable text");
    expect(scannedPdfFailureMessage).toContain("Retrying this same file");
  });

  it("gives empty DOCX files a format-appropriate recovery message", () => {
    expect(
      noReadableDocumentFailureMessage(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toContain("DOCX file containing editable text");
  });
});
