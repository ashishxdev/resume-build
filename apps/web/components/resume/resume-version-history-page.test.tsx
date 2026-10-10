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

import { ResumeVersionHistoryPage } from "./resume-version-history-page";

const mocks = vi.hoisted(() => ({
  activate: vi.fn(),
  deleteVersion: vi.fn(),
  download: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  rename: vi.fn(),
  replace: vi.fn(),
  restore: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ resumeId: "resume_1" }),
  useRouter: () => ({ replace: mocks.replace, refresh: vi.fn() }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signOut: mocks.signOut,
    useSession: mocks.useSession,
  },
}));

vi.mock("@/lib/resume/version-client", () => ({
  activateResumeVersion: mocks.activate,
  deleteResumeVersion: mocks.deleteVersion,
  downloadResumeVersion: mocks.download,
  getResumeVersion: mocks.get,
  listResumeVersions: mocks.list,
  renameResumeVersion: mocks.rename,
  restoreResumeVersion: mocks.restore,
}));

const personalClaim = {
  id: "claim_personal",
  category: "personal_info",
  label: "Contact information",
  value: "Alex Mercer | alex@example.com",
  sourceText: null,
  pageNumber: 1,
  status: "confirmed",
  userAdded: false,
  order: 0,
};

const baseClaim = {
  id: "claim_experience",
  category: "experience",
  label: "Engineer at Acme",
  value: "Built APIs.",
  sourceText: "Built APIs.",
  pageNumber: 1,
  status: "confirmed",
  userAdded: false,
  order: 1,
};

const tailoredClaim = {
  ...baseClaim,
  value: "Built reliable REST APIs.",
  status: "edited",
};

const baseSummary = {
  id: "version_base",
  resumeId: "resume_1",
  name: "Verified baseline",
  type: "base",
  versionNumber: 1,
  sourceVersionId: null,
  jobDescriptionId: null,
  tailoringSessionId: null,
  company: null,
  role: null,
  isActive: false,
  canDelete: false,
  deleteScope: null,
  deleteBlockedReason: "The verified baseline is permanently protected.",
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-01T08:00:00.000Z",
};

const tailoredSummary = {
  ...baseSummary,
  id: "version_tailored",
  name: "Acme Engineer",
  type: "tailored",
  versionNumber: 2,
  sourceVersionId: "version_base",
  jobDescriptionId: "job_1",
  tailoringSessionId: "tailor_1",
  company: "Acme",
  role: "Engineer",
  isActive: true,
  canDelete: false,
  deleteScope: "tailoring_session",
  deleteBlockedReason: "Activate another version before deleting this one.",
  createdAt: "2026-10-02T08:00:00.000Z",
  updatedAt: "2026-10-02T08:00:00.000Z",
};

const history = {
  resumeId: "resume_1",
  resumeName: "Engineering Resume",
  activeVersionId: "version_tailored",
  versions: [baseSummary, tailoredSummary],
};

const baseVersion = {
  ...baseSummary,
  claims: [personalClaim, baseClaim],
};

const tailoredVersion = {
  ...tailoredSummary,
  claims: [personalClaim, tailoredClaim],
};

describe("ResumeVersionHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          email: "alex@example.com",
          id: "user_1",
          name: "Alex Mercer",
        },
      },
      isPending: false,
    });
    mocks.list.mockResolvedValue(history);
    mocks.get.mockImplementation(
      async (_resumeId: string, versionId: string) =>
        versionId === "version_base" ? baseVersion : tailoredVersion,
    );
    mocks.activate.mockResolvedValue(undefined);
    mocks.deleteVersion.mockResolvedValue(undefined);
    mocks.rename.mockResolvedValue({
      ...tailoredVersion,
      name: "Acme application",
    });
    mocks.restore.mockResolvedValue({
      ...tailoredVersion,
      id: "version_restored",
      type: "restored",
      name: "Restored — Acme Engineer",
      versionNumber: 3,
      tailoringSessionId: null,
      sourceVersionId: "version_tailored",
      deleteScope: "version",
    });
    mocks.download.mockResolvedValue({
      blob: new Blob(["resume"]),
      filename: "acme-engineer.pdf",
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("previews the active version and compares exact claim changes", async () => {
    render(<ResumeVersionHistoryPage />);

    expect(
      await screen.findByRole("heading", { name: "Alex Mercer" }),
    ).toBeTruthy();
    expect(screen.getByText("Built reliable REST APIs.")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(await screen.findByText("See exactly what changed.")).toBeTruthy();
    expect(screen.getByText("Built APIs.")).toBeTruthy();
    expect(screen.getByText("Built reliable REST APIs.")).toBeTruthy();
    expect(screen.getByText("Changed")).toBeTruthy();
  });

  it("renames, restores, and downloads without rewriting history", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:resume");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
    render(<ResumeVersionHistoryPage />);
    await screen.findByRole("heading", { name: "Alex Mercer" });

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Acme application" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() =>
      expect(mocks.rename).toHaveBeenCalledWith(
        "resume_1",
        "version_tailored",
        "Acme application",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore as copy" }));
    await waitFor(() =>
      expect(mocks.restore).toHaveBeenCalledWith(
        "resume_1",
        "version_tailored",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith(
        "resume_1",
        "version_restored",
        "pdf",
        "comfortable",
      ),
    );
  });

  it("redirects signed-out visitors to the scoped login return URL", () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false });
    render(<ResumeVersionHistoryPage />);
    expect(mocks.replace).toHaveBeenCalledWith(
      "/login?redirect=%2Fresumes%2Fresume_1%2Fversions",
    );
  });
});
