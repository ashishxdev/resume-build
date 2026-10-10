// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceCollectionPage } from "./workspace-collection-page";

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

vi.mock("./resume-upload-dialog", () => ({
  ResumeUploadDialog: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog">
      <span>Resume upload dialog</span>
      <button onClick={onClose} type="button">
        Close upload
      </button>
    </div>
  ),
}));

const verifiedResume = {
  compatibilityStatus: "supported" as const,
  extractionStatus: "verified" as const,
  id: "resume_1",
  importId: "import_1",
  importStatus: "uploaded" as const,
  name: "Product Designer",
  originalFileName: "product-designer.pdf",
  updatedAt: "2026-10-08T08:00:00.000Z",
};

describe("WorkspaceCollectionPage", () => {
  beforeEach(() => {
    mocks.deleteResume.mockReset();
    mocks.deleteResume.mockResolvedValue(undefined);
    mocks.deleteTailoringSession.mockReset();
    mocks.deleteTailoringSession.mockResolvedValue(undefined);
    mocks.downloadTailoredResume.mockReset();
    mocks.downloadTailoredResume.mockResolvedValue({
      blob: new Blob(["resume"]),
      filename: "acme-resume.pdf",
    });
    mocks.listResumes.mockReset();
    mocks.listResumes.mockResolvedValue([]);
    mocks.listTailoringSessions.mockReset();
    mocks.listTailoringSessions.mockResolvedValue([]);
    mocks.replace.mockReset();
    mocks.signOut.mockReset();
    mocks.useSession.mockReset();
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
    vi.restoreAllMocks();
  });

  it("shows the complete resume library on its own active route", async () => {
    mocks.listResumes.mockResolvedValue([
      verifiedResume,
      {
        ...verifiedResume,
        id: "resume_2",
        importId: "import_2",
        name: "Design Systems",
        originalFileName: "design-systems.docx",
      },
    ]);

    render(React.createElement(WorkspaceCollectionPage, { page: "resumes" }));

    expect(await screen.findByText("product-designer.pdf")).toBeTruthy();
    expect(screen.getByText("design-systems.docx")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: "Resumes" })[0]
        ?.getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen
        .getAllByRole("link", { name: "Dashboard" })[0]
        ?.getAttribute("aria-current"),
    ).toBeNull();
    expect(
      screen
        .getAllByRole("link", { name: "Version history" })[0]
        ?.getAttribute("href"),
    ).toBe("/resumes/resume_1/versions");
  });

  it("shows every resume and tailoring record in activity history", async () => {
    mocks.listResumes.mockResolvedValue([
      verifiedResume,
      {
        ...verifiedResume,
        id: "resume_2",
        importId: "import_2",
        name: "Design Systems",
        updatedAt: "2026-10-06T08:00:00.000Z",
      },
      {
        ...verifiedResume,
        id: "resume_3",
        importId: "import_3",
        name: "Frontend Engineer",
        updatedAt: "2026-10-05T08:00:00.000Z",
      },
      {
        ...verifiedResume,
        id: "resume_4",
        importId: "import_4",
        name: "Staff Engineer",
        updatedAt: "2026-10-04T08:00:00.000Z",
      },
    ]);
    mocks.listTailoringSessions.mockResolvedValue([
      {
        company: "Acme",
        id: "tailor_1",
        resumeId: "resume_1",
        role: "Product Designer",
        status: "completed",
        updatedAt: "2026-10-07T08:00:00.000Z",
      },
      {
        company: "Vercel",
        id: "tailor_2",
        resumeId: "resume_2",
        role: "Design Engineer",
        status: "review",
        updatedAt: "2026-10-03T08:00:00.000Z",
      },
      {
        company: "Linear",
        id: "tailor_3",
        resumeId: "resume_3",
        role: "Frontend Engineer",
        status: "failed",
        updatedAt: "2026-10-02T08:00:00.000Z",
      },
    ]);

    render(React.createElement(WorkspaceCollectionPage, { page: "activity" }));

    expect(await screen.findByText("7 records")).toBeTruthy();
    expect(screen.getByText("Staff Engineer")).toBeTruthy();
    expect(screen.getByText("Vercel")).toBeTruthy();
    expect(screen.getByText("Linear")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: "Activity" })[0]
        ?.getAttribute("aria-current"),
    ).toBe("page");
  });

  it("preserves permanent deletion from the dedicated resume library", async () => {
    mocks.listResumes.mockResolvedValue([verifiedResume]);

    render(React.createElement(WorkspaceCollectionPage, { page: "resumes" }));

    fireEvent.click(
      await screen.findByRole("button", { name: "Delete Product Designer" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));

    expect(
      await screen.findByText("“Product Designer” was permanently deleted."),
    ).toBeTruthy();
    expect(mocks.deleteResume).toHaveBeenCalledWith("resume_1");
    expect(screen.queryByText("product-designer.pdf")).toBeNull();
  });

  it("previews, downloads, and deletes a tailored version without leaving the library", async () => {
    const tailoredVersion = {
      analysis: { matches: [], requirements: [], summary: "Aligned." },
      atsImprovedClaims: null,
      atsImprovedSnapshot: null,
      atsImprovedVersionId: null,
      atsImprovementActive: false,
      atsImprovementFailureMessage: null,
      atsImprovementStatus: "not_started",
      atsImprovementSuggestions: [],
      atsFailureMessage: null,
      atsSnapshot: null,
      atsStatus: "not_started",
      company: "Acme",
      createdAt: "2026-10-07T08:00:00.000Z",
      evidenceClaims: [],
      failureMessage: null,
      finalClaims: [
        {
          category: "personal_info",
          id: "claim_personal",
          label: "Contact information",
          order: 0,
          pageNumber: 1,
          sourceText: null,
          status: "confirmed",
          userAdded: false,
          value: "Alex Mercer | alex@example.com",
        },
        {
          category: "experience",
          id: "claim_experience",
          label: "Lead Product Designer at Northstar",
          order: 1,
          pageNumber: 1,
          sourceText: null,
          status: "edited",
          userAdded: false,
          value: "Led accessible design systems.",
        },
      ],
      id: "tailor_preview",
      jobDescriptionId: "job_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      revision: 4,
      role: "Product Designer",
      status: "completed",
      suggestions: [],
      tailoredVersionId: "version_tailored",
      updatedAt: "2026-10-08T08:00:00.000Z",
    };
    mocks.listResumes.mockResolvedValue([verifiedResume]);
    mocks.listTailoringSessions.mockResolvedValue([tailoredVersion]);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:resume");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );

    render(React.createElement(WorkspaceCollectionPage, { page: "resumes" }));

    fireEvent.click(await screen.findByRole("button", { name: "Preview" }));
    expect(
      screen.getByRole("dialog", { name: "Product Designer" }),
    ).toBeTruthy();
    expect(screen.getByText("Led accessible design systems.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() =>
      expect(mocks.downloadTailoredResume).toHaveBeenCalledWith(
        "tailor_preview",
        "pdf",
        "comfortable",
      ),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Delete this version" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect(
      await screen.findByText("The tailored version was permanently deleted."),
    ).toBeTruthy();
    expect(mocks.deleteTailoringSession).toHaveBeenCalledWith("tailor_preview");
    expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
  });

  it("redirects signed-out visitors back to login", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false });

    render(React.createElement(WorkspaceCollectionPage, { page: "activity" }));

    expect(mocks.replace).toHaveBeenCalledWith("/login?redirect=%2Factivity");
  });
});
