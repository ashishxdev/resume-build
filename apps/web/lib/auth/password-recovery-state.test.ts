import { describe, expect, it } from "vitest";

import {
  getPasswordResetErrorMessage,
  isInvalidResetTokenError,
} from "./password-recovery-state";

describe("password recovery state", () => {
  it("invalidates a reset link only for the invalid-token error", () => {
    expect(isInvalidResetTokenError({ code: "INVALID_TOKEN" })).toBe(true);
    expect(isInvalidResetTokenError({ code: "PASSWORD_TOO_LONG" })).toBe(false);
    expect(isInvalidResetTokenError({ status: 429 })).toBe(false);
    expect(isInvalidResetTokenError(null)).toBe(false);
  });

  it("gives retryable failures an actionable message", () => {
    expect(getPasswordResetErrorMessage({ status: 429 })).toContain(
      "Wait a moment",
    );
    expect(
      getPasswordResetErrorMessage({ code: "PASSWORD_TOO_LONG" }),
    ).toContain("128 characters");
    expect(getPasswordResetErrorMessage({ code: "UNKNOWN" })).toContain(
      "try again",
    );
  });
});
