import { describe, expect, it } from "vitest";

import { getSafeRedirect } from "./safe-redirect";

describe("getSafeRedirect", () => {
  it("keeps same-origin application paths", () => {
    expect(getSafeRedirect("/dashboard?view=recent#top")).toBe(
      "/dashboard?view=recent#top",
    );
  });

  it.each([
    undefined,
    "https://example.com",
    "//example.com",
    "/\\example.com",
  ])("falls back for unsafe redirect %s", (value) => {
    expect(getSafeRedirect(value)).toBe("/dashboard");
  });
});
