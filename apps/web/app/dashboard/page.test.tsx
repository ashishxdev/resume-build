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
  deleteResume: vi.fn(),
  deleteTailoringSession: vi.fn(),
  downloadTailoredResume: vi.fn(),
  listResumes: vi.fn(),
  listTailoringSessions: vi.fn(),
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
  deleteResume: mocks.deleteResume,
  listResumes: mocks.listResumes,
}));

vi.mock("@/lib/tailoring/client", () => ({
  deleteTailoringSession: mocks.deleteTailoringSession,
  downloadTailoredResume: mocks.downloadTailoredResume,
  listTailoringSessions: mocks.listTailoringSessions,
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
    mocks.deleteResume.mockReset();
    mocks.deleteTailoringSession.mockReset();
    mocks.downloadTailoredResume.mockReset();
    mocks.listResumes.mockReset();
    mocks.listTailoringSessions.mockReset();
    mocks.listResumes.mockResolvedValue([]);
    mocks.listTailoringSessions.mockResolvedValue([]);
    mocks.deleteResume.mockResolvedValue(undefined);
    mocks.deleteTailoringSession.mockResolvedValue(undefined);
    mocks.downloadTailoredResume.mockResolvedValue({
      blob: new Blob(["resume"]),
      filename: "acme-resume.pdf",
    });
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
    expect(screen.getAllByRole("link", { name: "Resumes" })[0]).toHaveProperty(
      "href",
      "http://localhost:3000/resumes",
    );
    expect(screen.getAllByRole("link", { name: "Activity" })[0]).toHaveProperty(
      "href",
      "http://localhost:3000/activity",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("opens the resume upload workflow", () => {
    render(React.createElement(DashboardPage));

    fireEvent.click(screen.getByRole("button", { name: "Upload resume" }));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Resume upload dialog")).toBeTruthy();
  });

  it("shows completed tailored versions and lets users reopen them", async () => {
    mocks.listTailoringSessions.mockResolvedValue([
      {
        id: "tailor_1",
        status: "completed",
        company: "Acme",
        role: "Product Designer",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    ]);
    render(React.createElement(DashboardPage));

    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(
      screen.getAllByText("Tailored drafts")[0]?.parentElement?.textContent,
    ).toContain("1Applications");
    expect(screen.getByRole("link", { name: "Open" })).toHaveProperty(
      "href",
      "http://localhost:3000/tailoring/tailor_1",
    );
  });

  it("shows, downloads, views, and deletes a saved tailored draft", async () => {
    const createObjectUrl = vi.fn(() => "blob:tailored-resume");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl,
    });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    mocks.listTailoringSessions.mockResolvedValue([
      {
        id: "tailor_saved",
        resumeId: "resume_1",
        status: "completed",
        company: "Acme",
        role: "Product Designer",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    ]);
    render(React.createElement(DashboardPage));

    expect(await screen.findByText("1 saved")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View" })).toHaveProperty(
      "href",
      "http://localhost:3000/tailoring/tailor_saved/resume",
    );
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    await act(async () => {});
    expect(mocks.downloadTailoredResume).toHaveBeenCalledWith(
      "tailor_saved",
      "pdf",
      "comfortable",
    );
    expect(createObjectUrl).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:tailored-resume");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete tailored draft Product Designer",
      }),
    );
    expect(
      screen.getByRole("heading", { name: "Delete this tailored draft?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await screen.findByText("The tailored draft was permanently deleted.");
    expect(mocks.deleteTailoringSession).toHaveBeenCalledWith("tailor_saved");
    expect(screen.getByText("No tailored drafts yet")).toBeTruthy();
  });

  it("keeps resumes visible when tailoring activity fails", async () => {
    mocks.listResumes.mockResolvedValue([
      {
        id: "resume_1",
        name: "Product Designer",
        originalFileName: "resume.pdf",
        importId: "import_1",
        importStatus: "uploaded",
        extractionStatus: "verified",
        compatibilityStatus: "supported",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    ]);
    mocks.listTailoringSessions.mockRejectedValue(new Error("Unavailable"));
    render(React.createElement(DashboardPage));

    expect(
      (await screen.findAllByText("Product Designer")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/could not load tailored-version activity/i),
    ).toBeTruthy();
    expect(
      screen.queryByText(/could not load your resume library/i),
    ).toBeNull();
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

  it("confirms permanent resume deletion and removes it from the dashboard", async () => {
    mocks.listResumes.mockResolvedValue([
      {
        id: "resume_delete",
        name: "Product Designer",
        originalFileName: "resume.pdf",
        importId: "import_delete",
        importStatus: "uploaded",
        extractionStatus: "verified",
        compatibilityStatus: "supported",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    ]);
    mocks.listTailoringSessions.mockResolvedValue([
      {
        id: "tailor_delete",
        resumeId: "resume_delete",
        status: "completed",
        company: "Acme",
        role: "Product Designer",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    ]);
    render(React.createElement(DashboardPage));

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Product Designer" }),
    );
    expect(
      screen.getByRole("heading", { name: "Delete “Product Designer”?" }),
    ).toBeTruthy();
    expect(screen.getByText(/Cloudflare storage/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    await screen.findByText("“Product Designer” was permanently deleted.");
    expect(mocks.deleteResume).toHaveBeenCalledWith("resume_delete");
    expect(screen.queryByText("resume.pdf")).toBeNull();
    expect(screen.queryByText("Acme")).toBeNull();
  });

  it("keeps the confirmation open when resume deletion fails", async () => {
    mocks.deleteResume.mockRejectedValueOnce(new Error("Unavailable"));
    mocks.listResumes.mockResolvedValue([
      {
        id: "resume_delete_failure",
        name: "Design Systems",
        originalFileName: "design-systems.pdf",
        importId: "import_delete_failure",
        importStatus: "uploaded",
        extractionStatus: "verified",
        compatibilityStatus: "supported",
        updatedAt: "2026-10-03T10:00:00.000Z",
      },
    ]);
    render(React.createElement(DashboardPage));

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Design Systems" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(
      await screen.findByText(
        "We could not delete this resume from cloud storage. Please try again.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("design-systems.pdf")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Delete permanently" }),
    ).toBeTruthy();
  });

  it("gives feedback for notifications", () => {
    render(React.createElement(DashboardPage));

    fireEvent.click(
      screen.getByRole("button", { name: "Notifications — none unread" }),
    );
    expect(
      screen.getByText("You’re all caught up—there are no new notifications."),
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
