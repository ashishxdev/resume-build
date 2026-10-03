// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { validateResumeFile } from "./import-client";

describe("validateResumeFile", () => {
  it("accepts supported files and derives the import source", () => {
    const file = new File(["%PDF-test"], "resume.pdf", {
      type: "application/pdf",
    });

    expect(validateResumeFile(file)).toEqual({
      data: {
        fileName: "resume.pdf",
        mimeType: "application/pdf",
        size: 9,
        sourceType: "pdf",
      },
    });
  });

  it("supports DOCX files whose browser omits the MIME type", () => {
    const file = new File(["PK-test"], "resume.docx");

    expect(validateResumeFile(file).data?.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("rejects empty, oversized, unsupported, and mismatched files", () => {
    expect(validateResumeFile(new File([], "empty.pdf")).error).toMatch(
      /not empty/,
    );
    expect(
      validateResumeFile(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
          type: "application/pdf",
        }),
      ).error,
    ).toMatch(/smaller than 10 MB/);
    expect(validateResumeFile(new File(["x"], "resume.txt")).error).toMatch(
      /PDF or DOCX/,
    );
    expect(
      validateResumeFile(new File(["x"], "resume.pdf", { type: "image/png" }))
        .error,
    ).toMatch(/PDF or DOCX/);
    expect(
      validateResumeFile(
        new File(["image"], "resume.png", { type: "image/png" }),
      ).error,
    ).toMatch(/Images are not supported/);
  });
});
