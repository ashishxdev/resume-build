import { describe, expect, it } from "vitest";

import {
  createDocxDocumentPage,
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
});
