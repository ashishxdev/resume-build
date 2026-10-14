// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthPage } from "./auth-page";

const authMocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  useSession: vi.fn(() => ({ data: null })),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: { email: authMocks.signInEmail },
    signUp: { email: authMocks.signUpEmail },
    useSession: authMocks.useSession,
  },
}));

afterEach(() => {
  cleanup();
});

describe("AuthPage", () => {
  it("offers email and password sign-in without a social provider", () => {
    render(
      React.createElement(AuthPage, {
        mode: "signin",
        redirectTo: "/dashboard",
      }),
    );

    expect(screen.getByLabelText("Work or personal email")).toBeTruthy();
    expect(document.querySelector('input[name="password"]')).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Sign in to workspace/ }),
    ).toBeTruthy();
    expect(screen.queryByText(/Google/i)).toBeNull();
  });
});
