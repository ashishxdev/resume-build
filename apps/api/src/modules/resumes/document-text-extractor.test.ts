import { describe, expect, it } from "vitest";
import { Document, ExternalHyperlink, Packer, Paragraph, TextRun } from "docx";

import {
  attachPdfLinksToTextItems,
  assertDocxArchiveLimits,
  assertPdfPageLimit,
  createDocxDocumentPage,
  documentExtractionLimits,
  docxHtmlToLinkedText,
  DocumentExtractionLimitError,
  extractDocumentText,
  joinPdfTextItems,
} from "./document-text-extractor.js";

function item(str: string, x: number, width: number, y = 700, hasEOL = false) {
  return {
    str,
    width,
    height: 10,
    transform: [1, 0, 0, 1, x, y],
    hasEOL,
  };
}

describe("joinPdfTextItems", () => {
  it("merges adjacent glyph fragments without corrupting words", () => {
    const text = joinPdfTextItems([
      item("Built", 0, 22),
      item("automated", 25, 44),
      item("regression", 72, 45),
      item("suites", 120, 24),
      item("and", 147, 15),
      item("veri", 165, 18),
      item("fie", 183, 12),
      item("d", 195, 5),
      item("production", 203, 48),
      item("releases.", 254, 38),
    ]);

    expect(text).toBe(
      "Built automated regression suites and verified production releases.",
    );
  });

  it("uses line geometry and end-of-line markers for line breaks", () => {
    expect(
      joinPdfTextItems([
        item("Experience", 0, 50, 700, true),
        item("Product Designer", 0, 72, 680),
      ]),
    ).toBe("Experience\nProduct Designer");
  });

  it("preserves safe hyperlink annotations beside their visible PDF label", () => {
    const items = [item("Portfolio", 0, 42), item("Live", 50, 20)];
    const linked = attachPdfLinksToTextItems(items, [
      {
        subtype: "Link",
        url: "https://example.com/project",
        rect: [49, 696, 72, 712],
      },
      {
        subtype: "Link",
        url: "https://example.com/portfolio",
        rect: [0, 696, 42, 712],
      },
    ]);

    expect(joinPdfTextItems(linked)).toBe(
      "Portfolio (https://example.com/portfolio) Live (https://example.com/project)",
    );
  });
});

describe("docxHtmlToLinkedText", () => {
  it("keeps safe hyperlink destinations with their labels", () => {
    expect(
      docxHtmlToLinkedText(
        '<p>My project | <a href="https://example.com/demo">Live</a></p>',
      ),
    ).toBe("My project | Live (https://example.com/demo)");
  });
});

describe("createDocxDocumentPage", () => {
  it("assigns a synthetic page identifier that AI evidence can ground", () => {
    expect(createDocxDocumentPage("  Summary\nProduct designer  ")).toEqual([
      { pageNumber: 1, text: "Summary\nProduct designer" },
    ]);
  });

  it("rejects extracted text that exceeds the character budget", () => {
    expect(() =>
      createDocxDocumentPage(
        "x".repeat(documentExtractionLimits.maximumExtractedCharacters + 1),
      ),
    ).toThrow(DocumentExtractionLimitError);
  });

  it("extracts a normal DOCX after validating its archive budget", async () => {
    const bytes = await Packer.toBuffer(
      new Document({
        sections: [
          { children: [new Paragraph("Built reliable TypeScript services.")] },
        ],
      }),
    );
    await expect(
      extractDocumentText(
        bytes,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).resolves.toEqual([
      { pageNumber: 1, text: "Built reliable TypeScript services." },
    ]);
  });

  it("preserves an external DOCX project hyperlink", async () => {
    const bytes = await Packer.toBuffer(
      new Document({
        sections: [
          {
            children: [
              new Paragraph({
                children: [
                  new TextRun("My project | "),
                  new ExternalHyperlink({
                    link: "https://example.com/demo",
                    children: [new TextRun("Live")],
                  }),
                ],
              }),
            ],
          },
        ],
      }),
    );
    const result = await extractDocumentText(
      bytes,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result[0]?.text).toContain(
      "My project | Live (https://example.com/demo)",
    );
  });
});

describe("document resource limits", () => {
  it("rejects PDFs with excessive page counts", () => {
    expect(() =>
      assertPdfPageLimit(documentExtractionLimits.maximumPdfPages + 1),
    ).toThrow(/at most/);
  });

  it("rejects DOCX archives with excessive entries or expanded size", () => {
    expect(() =>
      assertDocxArchiveLimits(
        Array.from(
          { length: documentExtractionLimits.maximumDocxEntries + 1 },
          () => ({ uncompressedSize: 0 }),
        ),
      ),
    ).toThrow(/too many archive entries/);

    expect(() =>
      assertDocxArchiveLimits([
        {
          uncompressedSize:
            documentExtractionLimits.maximumDocxUncompressedBytes + 1,
        },
      ]),
    ).toThrow(/expanded DOCX is too large/);
  });
});
