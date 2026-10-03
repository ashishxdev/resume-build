// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResumeVerificationPage } from "./resume-verification-page";

const mocks = vi.hoisted(() => ({
  getResumeVerification: vi.fn(),
  replace: vi.fn(),
  retryResumeExtraction: vi.fn(),
  saveResumeVerification: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useSession: () => ({ data: { user: { id: "user_1" } }, isPending: false }),
  },
}));
vi.mock("@/lib/resume/verification-client", () => ({
  getResumeVerification: mocks.getResumeVerification,
  retryResumeExtraction: mocks.retryResumeExtraction,
  saveResumeVerification: mocks.saveResumeVerification,
}));

const review = {
  resumeId: "resume_1",
  versionId: null,
  jobId: "job_1",
  status: "review_required" as const,
  progress: 100,
  failureMessage: null,
  claims: [
    {
      id: "claim_1",
      category: "experience" as const,
      label: "Experience",
      value: "Led a design system rollout",
      sourceText: "Led a design system rollout",
      pageNumber: 2,
      status: "unreviewed" as const,
      userAdded: false,
      order: 0,
    },
  ],
  createdAt: "2026-10-02T10:00:00.000Z",
  updatedAt: "2026-10-02T10:00:00.000Z",
};

describe("ResumeVerificationPage", () => {
  beforeEach(() => {
    mocks.getResumeVerification.mockReset().mockResolvedValue(review);
    mocks.retryResumeExtraction.mockReset();
    mocks.saveResumeVerification
      .mockReset()
      .mockImplementation(async (_id, claims) => ({
        ...review,
        status: "verified",
        versionId: "version_1",
        claims,
      }));
  });

  afterEach(() => cleanup());

  it("shows source provenance and saves a reviewed claim", async () => {
    render(<ResumeVerificationPage resumeId="resume_1" />);
    expect(
      await screen.findByDisplayValue("Led a design system rollout"),
    ).toBeTruthy();
    expect(screen.getByText("Source · page 2")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "✓ Confirm" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save verified baseline" }),
    );

    await waitFor(() =>
      expect(mocks.saveResumeVerification).toHaveBeenCalledOnce(),
    );
    expect(mocks.saveResumeVerification.mock.calls[0]?.[1][0]).toMatchObject({
      status: "confirmed",
    });
  });

  it("restarts polling after a failed extraction is retried", async () => {
    const failed = {
      ...review,
      status: "failed" as const,
      claims: [],
      failureMessage: "No readable text was found in this document.",
    };
    mocks.getResumeVerification
      .mockReset()
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce({
        ...review,
        status: "processing",
        progress: 20,
        claims: [],
      })
      .mockResolvedValueOnce(failed);
    mocks.retryResumeExtraction.mockResolvedValue({
      ...review,
      status: "queued",
      claims: [],
    });
    render(<ResumeVerificationPage resumeId="resume_1" />);

    expect(
      await screen.findByText("We couldn’t read this document."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry extraction" }));
    await waitFor(() =>
      expect(mocks.retryResumeExtraction).toHaveBeenCalledWith("resume_1"),
    );
    expect(await screen.findByText("We’re reading your resume.")).toBeTruthy();
    expect(
      await screen.findByText("We couldn’t read this document.", undefined, {
        timeout: 2_500,
      }),
    ).toBeTruthy();
    expect(mocks.getResumeVerification).toHaveBeenCalledTimes(3);
  });
});
