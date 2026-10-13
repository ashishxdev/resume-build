import { describe, expect, it } from "vitest";
import { Document, Packer, Paragraph } from "docx";

import {
  assertDocxArchiveLimits,
  assertPdfPageLimit,
  createDocxDocumentPage,
  documentExtractionLimits,
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
