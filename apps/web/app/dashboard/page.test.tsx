// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DashboardPage from "./page";

const mocks = vi.hoisted(() => ({
  listResumes: vi.fn(),
  replace: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: mocks.signOut,
    useSession: mocks.useSession,
  },
}));

vi.mock("@/lib/resume/import-client", () => ({
  listResumes: mocks.listResumes,
}));

vi.mock("@/components/dashboard/resume-upload-dialog", () => ({
  ResumeUploadDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog">
      <span>Resume upload dialog</span>
      <button onClick={onClose} type="button">
        Close upload
      </button>
    </div>
  ),
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.listResumes.mockReset();
    mocks.listResumes.mockResolvedValue([]);
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          email: "alex@example.com",
          id: "user_alex",
          name: "Alex Mercer",
        },
      },
      isPending: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders an authenticated user's truthful empty workspace", () => {
    render(React.createElement(DashboardPage));

    expect(screen.getByRole("heading", { name: /Alex\./ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Your resumes" })).toBeTruthy();
    expect(screen.getByText("0 uploaded")).toBeTruthy();
    expect(screen.getByText("No activity yet")).toBeTruthy();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("opens the resume upload workflow", () => {
    render(React.createElement(DashboardPage));

    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Resume upload dialog")).toBeTruthy();
  });

  it("explains legacy image imports and offers a supported replacement", async () => {
    mocks.listResumes.mockResolvedValue([
      {
        id: "resume_legacy",
        name: "Legacy image resume",
        originalFileName: "resume.png",
        importId: "import_legacy",
        importStatus: "uploaded",
        extractionStatus: null,
        compatibilityStatus: "unsupported_legacy_format",
        updatedAt: "2026-10-02T10:00:00.000Z",
      },
    ]);
    render(React.createElement(DashboardPage));

    expect(await screen.findByText("Unsupported image import")).toBeTruthy();
    expect(
      screen.getByText("Replace with a PDF or DOCX to continue"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Upload PDF/DOCX" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("gives feedback for notifications and plan upgrades", () => {
    render(React.createElement(DashboardPage));

    fireEvent.click(
      screen.getByRole("button", { name: "Notifications — none unread" }),
    );
    expect(
      screen.getByText("You’re all caught up—there are no new notifications."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Upgrade" }));
    expect(
      screen.getByText(
        "Plan upgrades will be available when billing is introduced. Your free plan includes 2 tailored resumes.",
      ),
    ).toBeTruthy();
  });

  it("keeps the initial greeting stable when server and client times differ", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 8));

    const markup = renderToString(React.createElement(DashboardPage));
    const container = document.createElement("div");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    let root: Root | undefined;

    expect(markup).toContain("Welcome back");
    container.innerHTML = markup;
    document.body.append(container);
    vi.setSystemTime(new Date(2026, 9, 2, 15));

    try {
      await act(async () => {
        root = hydrateRoot(container, React.createElement(DashboardPage));
      });

      expect(container.textContent).toContain("Good afternoon, Alex.");
      expect(
        consoleError.mock.calls.some((call) =>
          call.some(
            (value) =>
              typeof value === "string" &&
              value.toLowerCase().includes("hydration"),
          ),
        ),
      ).toBe(false);
    } finally {
      await act(async () => root?.unmount());
      container.remove();
      consoleError.mockRestore();
      vi.useRealTimers();
    }
  });

  it("targets the existing integrity section and hides the unread dot at zero", () => {
    render(React.createElement(DashboardPage));

    expect(
      screen.getByRole("link", { name: "Learn about verification →" }),
    ).toHaveProperty("href", "http://localhost:3000/#integrity");
    expect(screen.getByRole("link", { name: "Methodology" })).toHaveProperty(
      "href",
      "http://localhost:3000/#integrity",
    );
    expect(
      screen
        .getByRole("button", { name: "Notifications — none unread" })
        .getAttribute("data-has-unread"),
    ).toBe("false");
  });

  it("redirects a signed-out visitor to login", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false });

    render(React.createElement(DashboardPage));

    expect(mocks.replace).toHaveBeenCalledWith("/login?redirect=%2Fdashboard");
  });
});
