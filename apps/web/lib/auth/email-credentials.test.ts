import { describe, expect, it } from "vitest";

import { prepareEmailCredentials } from "./email-credentials";

describe("prepareEmailCredentials", () => {
  it("trims sign-in email addresses", () => {
    expect(
      prepareEmailCredentials({
        email: "  alex@example.com  ",
        mode: "signin",
        name: "",
        password: "strong-password",
      }),
    ).toEqual({
      credentials: {
        email: "alex@example.com",
        password: "strong-password",
      },
      error: null,
    });
  });

  it("trims sign-up names and email addresses", () => {
    expect(
      prepareEmailCredentials({
        email: "  alex@example.com  ",
        mode: "signup",
        name: "  Alex Mercer  ",
        password: "strong-password",
      }),
    ).toEqual({
      credentials: {
        email: "alex@example.com",
        name: "Alex Mercer",
        password: "strong-password",
      },
      error: null,
    });
  });

  it("rejects whitespace-only sign-up names", () => {
    expect(
      prepareEmailCredentials({
        email: "alex@example.com",
        mode: "signup",
        name: "   ",
        password: "strong-password",
      }),
    ).toEqual({
      credentials: null,
      error: "Please enter a name with at least 2 characters.",
    });
  });
});
