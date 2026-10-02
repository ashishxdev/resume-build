// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordRecoveryPage } from "./password-recovery-page";

const authMocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: authMocks,
}));

vi.mock("@/lib/env/client", () => ({
  clientEnvironment: {
    NEXT_PUBLIC_API_URL: "http://localhost:4000",
  },
}));

vi.mock("./auth-page", () => ({
  AuthBrand: () => React.createElement("span", null, "Make My Resume"),
}));

function jsonResponse(body: unknown, ok = true) {
  return {
    json: vi.fn().mockResolvedValue(body),
    ok,
  } as unknown as Response;
}

function renderResetPage() {
  return render(
    React.createElement(PasswordRecoveryPage, {
      mode: "reset",
      token: "valid-looking-reset-token",
    }),
  );
}

describe("PasswordRecoveryPage reset-token states", () => {
  beforeEach(() => {
    authMocks.requestPasswordReset.mockReset();
    authMocks.resetPassword.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows a checking state without exposing the password form", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );

    renderResetPage();

    expect(screen.getByText("Checking your secure reset link…")).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("shows recovery actions when the token is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ valid: false })),
    );

    renderResetPage();

    expect(
      await screen.findByText(
        "This password-reset link is invalid or has expired.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Request a new link")).toBeTruthy();
    expect(screen.queryByLabelText("New password")).toBeNull();
  });

  it("offers a retry when token validation is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    renderResetPage();

    expect(
      await screen.findByText(
        "We could not verify this reset link right now. Please try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("preserves the form after a retryable reset error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ valid: true })),
    );
    authMocks.resetPassword.mockResolvedValue({
      error: { status: 429 },
    });

    renderResetPage();

    const password = await screen.findByLabelText("New password");
    const confirmation = screen.getByLabelText("Confirm new password");
    fireEvent.change(password, { target: { value: "new-password-123" } });
    fireEvent.change(confirmation, {
      target: { value: "new-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Update password/ }));

    expect(await screen.findByText(/Too many attempts/)).toBeTruthy();
    expect(screen.getByLabelText("New password")).toBeTruthy();
    expect(screen.queryByText("Request a new link")).toBeNull();
  });
});
