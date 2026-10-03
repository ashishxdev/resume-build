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

import { JobDescriptionWorkflow } from "./job-description-workflow";
import { MatchOverview } from "./match-overview";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getJob: vi.fn(),
  getVerification: vi.fn(),
  listResumes: vi.fn(),
  params: { resumeId: "resume_1", jobDescriptionId: "jd_1" },
  push: vi.fn(),
  replace: vi.fn(),
  retry: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => mocks.params,
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { useSession: mocks.useSession },
}));

vi.mock("@/lib/resume/import-client", () => ({
  listResumes: mocks.listResumes,
}));

vi.mock("@/lib/resume/verification-client", () => ({
  getResumeVerification: mocks.getVerification,
}));

vi.mock("@/lib/job-description/client", () => ({
  createJobDescription: mocks.create,
  getJobDescription: mocks.getJob,
  retryJobDescriptionAnalysis: mocks.retry,
}));

const verification = {
  resumeId: "resume_1",
  versionId: "version_1",
  jobId: "job_1",
  status: "verified",
  progress: 100,
  failureMessage: null,
  claims: [
    {
      id: "claim_1",
      category: "skills",
      label: "Design systems",
      value: "Led design-system work.",
      sourceText: "Led design-system work.",
      pageNumber: 1,
      userAdded: false,
      status: "confirmed",
      order: 0,
    },
  ],
  createdAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
};

describe("tailoring workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({
      data: { user: { id: "user_1", email: "qa@example.com" } },
      isPending: false,
    });
    mocks.listResumes.mockResolvedValue([]);
    mocks.getVerification.mockResolvedValue(verification);
  });

  afterEach(cleanup);

  it("navigates to the durable analysis record as soon as it is queued", async () => {
    mocks.create.mockResolvedValue({
      id: "jd_queued",
      status: "queued",
    });
    render(<JobDescriptionWorkflow />);

    const description = await screen.findByLabelText(/Job description/);
    fireEvent.change(description, { target: { value: "A".repeat(120) } });
    fireEvent.click(screen.getByRole("button", { name: /Analyze match/ }));

    expect(mocks.create).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/job-descriptions/jd_queued"),
    );
  });

  it("filters the match overview while preserving grounded evidence", async () => {
    mocks.getJob.mockResolvedValue({
      id: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: "Product Designer",
      company: "Acme",
      rawText: "A".repeat(120),
      status: "completed",
      failureMessage: null,
      evidenceClaims: verification.claims,
      analysis: {
        summary: "Two grounded requirements.",
        requirements: [
          {
            id: "req_1",
            category: "skill",
            priority: "required",
            label: "Design systems",
            sourceQuote: "Design systems",
          },
          {
            id: "req_2",
            category: "experience",
            priority: "preferred",
            label: "Mentoring",
            sourceQuote: "Mentoring",
          },
        ],
        matches: [
          {
            requirementId: "req_1",
            status: "strong",
            resumeClaimIds: ["claim_1"],
            explanation: "Direct evidence.",
          },
          {
            requirementId: "req_2",
            status: "missing",
            resumeClaimIds: [],
            explanation: "No evidence.",
          },
        ],
      },
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    render(<MatchOverview />);

    expect(
      await screen.findByRole("heading", { name: "Design systems" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Missing 1/ }));
    expect(
      screen.queryByRole("heading", { name: "Design systems" }),
    ).toBeNull();
    expect(screen.getByRole("heading", { name: "Mentoring" })).toBeTruthy();
    expect(screen.getByText(/Nothing will be invented/)).toBeTruthy();
    expect(mocks.getVerification).not.toHaveBeenCalled();
  });

  it("requeues a failed record and resumes status polling", async () => {
    const failed = {
      id: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      evidenceClaims: verification.claims,
      role: null,
      company: null,
      rawText: "A".repeat(120),
      status: "failed",
      failureMessage: "Gemini is temporarily busy.",
      analysis: null,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    };
    const queued = { ...failed, status: "queued", failureMessage: null };
    mocks.getJob.mockResolvedValueOnce(failed).mockResolvedValue(queued);
    mocks.retry.mockResolvedValue(queued);
    render(<MatchOverview />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Try analysis again" }),
    );

    await waitFor(() => expect(mocks.retry).toHaveBeenCalledWith("jd_1"));
    expect(
      await screen.findByText(/Your analysis is safely queued/),
    ).toBeTruthy();
    await waitFor(() => expect(mocks.getJob).toHaveBeenCalledTimes(2));
  });
});
