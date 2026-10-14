// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivateResumeShareButton } from "./private-resume-share-button";

const mocks = vi.hoisted(() => ({
  createShare: vi.fn(),
  getShare: vi.fn(),
  listVersions: vi.fn(),
  setShareEnabled: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock("@/lib/resume/version-client", () => ({
  createResumeVersionShare: mocks.createShare,
  getResumeVersionShare: mocks.getShare,
  listResumeVersions: mocks.listVersions,
  setResumeVersionShareEnabled: mocks.setShareEnabled,
}));

describe("PrivateResumeShareButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listVersions.mockResolvedValue({
      activeVersionId: "version_active",
      resumeId: "resume_1",
      resumeName: "Product Designer",
      versions: [],
    });
    mocks.getShare.mockResolvedValue(null);
    mocks.createShare.mockResolvedValue({
      createdAt: "2026-10-13T12:00:00.000Z",
      enabled: true,
      id: "share_1",
      resumeId: "resume_1",
      token: "a".repeat(43),
      updatedAt: "2026-10-13T12:00:00.000Z",
      versionId: "version_active",
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("creates and copies a private link for the active resume version", async () => {
    render(
      <PrivateResumeShareButton
        compact
        resumeId="resume_1"
        resumeName="Product Designer"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Share Product Designer privately",
      }),
    );

    await waitFor(() =>
      expect(mocks.createShare).toHaveBeenCalledWith(
        "resume_1",
        "version_active",
      ),
    );
    expect(mocks.writeText).toHaveBeenCalledWith(
      `${window.location.origin}/r/${"a".repeat(43)}`,
    );
    expect(await screen.findByText("Private link copied")).toBeTruthy();
  });

  it("keeps the generated URL available when clipboard permission is denied", async () => {
    mocks.writeText.mockRejectedValueOnce(new Error("permission denied"));
    render(
      <PrivateResumeShareButton
        resumeId="resume_1"
        resumeName="Product Designer"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Share Product Designer privately",
      }),
    );

    const manualLink = await screen.findByLabelText("Copy private link");
    expect((manualLink as HTMLInputElement).value).toBe(
      `${window.location.origin}/r/${"a".repeat(43)}`,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Clipboard access was blocked",
    );
  });
});
