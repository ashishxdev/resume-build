import { describe, expect, it } from "vitest";

import { normalizeResumeText } from "./normalize-resume-text.js";

describe("normalizeResumeText", () => {
  it("normalizes surrounding and repeated whitespace", () => {
    expect(normalizeResumeText("  Node.js   and Express  ")).toBe(
      "Node.js and Express",
    );
  });
});
