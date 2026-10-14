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

  it("shows editable content without duplicating source text and saves it", async () => {
    render(<ResumeVerificationPage resumeId="resume_1" />);
    expect(
      await screen.findByText(
        /Review the résumé content below\. Keep each detail as written/,
      ),
    ).toBeTruthy();
    expect(
      await screen.findByDisplayValue("Led a design system rollout"),
    ).toBeTruthy();
    expect(screen.getByText("Resume text")).toBeTruthy();
    expect(screen.queryByText("Source · page 2")).toBeNull();

    fireEvent.change(screen.getByDisplayValue("Led a design system rollout"), {
      target: { value: "Led and scaled a verified design system rollout" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Save verified baseline" }),
    );

    await waitFor(() =>
      expect(mocks.saveResumeVerification).toHaveBeenCalledOnce(),
    );
    expect(mocks.saveResumeVerification.mock.calls[0]?.[1][0]).toMatchObject({
      sourceText: "Led a design system rollout",
      status: "edited",
      value: "Led and scaled a verified design system rollout",
    });
    expect(
      screen.getByDisplayValue(
        "Led and scaled a verified design system rollout",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Verified baseline saved. Future tailoring will use these details.",
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Baseline saved",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      screen
        .getByRole("link", { name: /Tailor this résumé/ })
        .getAttribute("href"),
    ).toBe("/resumes/resume_1/tailor");
    expect(
      screen
        .getByRole("link", { name: "Return to dashboard" })
        .getAttribute("href"),
    ).toBe("/dashboard");
  });

  it("restarts polling after a failed extraction is retried", async () => {
    const failed = {
      ...review,
      status: "failed" as const,
      claims: [],
      failureMessage:
        "The document could not be extracted. Try a text-based PDF or DOCX file.",
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

  it("explains scanned PDFs and does not offer a useless retry", async () => {
    mocks.getResumeVerification.mockResolvedValue({
      ...review,
      status: "failed" as const,
      claims: [],
      failureMessage:
        "This PDF appears to be scanned or flattened and contains no selectable text. Upload the original text-based PDF or a DOCX file. Retrying this same file will not work.",
    });

    render(<ResumeVerificationPage resumeId="resume_1" />);

    expect(
      await screen.findByRole("heading", {
        name: "This document has no selectable text.",
      }),
    ).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "scanned or flattened",
    );
    expect(
      screen.getByText(/You should be able to highlight and copy its text/),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry extraction" }),
    ).toBeNull();
    expect(
      screen
        .getByRole("link", { name: "Upload a different file" })
        .getAttribute("href"),
    ).toBe("/dashboard");
  });

  it("recognizes the legacy no-readable-text failure immediately", async () => {
    mocks.getResumeVerification.mockResolvedValue({
      ...review,
      status: "failed" as const,
      claims: [],
      failureMessage: "No readable text was found in this document.",
    });

    render(<ResumeVerificationPage resumeId="resume_1" />);

    expect(
      await screen.findByRole("heading", {
        name: "This document has no selectable text.",
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Retry extraction" }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: "Upload a different file" }),
    ).toBeTruthy();
  });
});
