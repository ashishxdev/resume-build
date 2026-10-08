// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomepageHeader } from "./homepage-header";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: mocks.useSession,
  },
}));

describe("HomepageHeader", () => {
  beforeEach(() => {
    mocks.refetch.mockReset();
    mocks.refetch.mockResolvedValue(undefined);
    mocks.useSession.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("offers login and signup actions to signed-out visitors", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      isPending: false,
      refetch: mocks.refetch,
    });

    render(React.createElement(HomepageHeader));

    expect(screen.getAllByRole("link", { name: "Log in" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Get started" })).toHaveLength(
      2,
    );
    expect(screen.queryByRole("link", { name: /Dashboard/ })).toBeNull();
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("replaces login and signup with dashboard links for signed-in users", () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          email: "alex@example.com",
          id: "user_alex",
          name: "Alex Mercer",
        },
      },
      isPending: false,
      refetch: mocks.refetch,
    });

    render(React.createElement(HomepageHeader));

    expect(screen.getAllByRole("link", { name: /Dashboard/ })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Get started" })).toBeNull();
  });

  it("keeps account actions neutral while the session is loading", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      isPending: true,
      refetch: mocks.refetch,
    });

    render(React.createElement(HomepageHeader));

    expect(screen.getAllByLabelText("Checking account status")).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Get started" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Dashboard/ })).toBeNull();
  });

  it("closes the mobile menu after selecting an on-page destination", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      isPending: false,
      refetch: mocks.refetch,
    });

    const { container } = render(React.createElement(HomepageHeader));
    const menu = container.querySelector("details");
    menu?.setAttribute("open", "");

    fireEvent.click(screen.getAllByRole("link", { name: /How it works/ })[1]!);

    expect(menu?.hasAttribute("open")).toBe(false);
  });
});
