import { describe, expect, it } from "vitest";

import { createId } from "./create-id.js";

describe("createId", () => {
  it("creates an opaque ID with the requested domain prefix", () => {
    expect(createId("resume")).toMatch(
      /^resume_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
