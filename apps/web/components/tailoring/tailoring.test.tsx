// @vitest-environment jsdom

import {
  act,
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
import { TailoringSessionPage } from "./tailoring-session-page";
import { AtsAnalysisPage, atsAlignmentHeadline } from "./ats-analysis-page";
import { ResumeDocumentPage } from "./resume-document-page";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  getJob: vi.fn(),
  getVerification: vi.fn(),
  listResumes: vi.fn(),
  params: {
    resumeId: "resume_1",
    jobDescriptionId: "jd_1",
    tailoringSessionId: "tailor_1",
  },
  push: vi.fn(),
  replace: vi.fn(),
  retry: vi.fn(),
  createTailoring: vi.fn(),
  getTailoring: vi.fn(),
  decideSuggestion: vi.fn(),
  decideAll: vi.fn(),
  completeTailoring: vi.fn(),
  retryTailoring: vi.fn(),
  startAts: vi.fn(),
  retryAts: vi.fn(),
  startAtsImprovements: vi.fn(),
  retryAtsImprovements: vi.fn(),
  decideAtsImprovement: vi.fn(),
  completeAtsImprovements: vi.fn(),
  setAtsImprovedVersionActive: vi.fn(),
  downloadResume: vi.fn(),
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

vi.mock("@/lib/tailoring/client", () => ({
  createTailoringSession: mocks.createTailoring,
  getTailoringSession: mocks.getTailoring,
  decideSuggestion: mocks.decideSuggestion,
  decideAll: mocks.decideAll,
  completeTailoringSession: mocks.completeTailoring,
  retryTailoringSession: mocks.retryTailoring,
  startAtsAnalysis: mocks.startAts,
  retryAtsAnalysis: mocks.retryAts,
  startAtsImprovements: mocks.startAtsImprovements,
  retryAtsImprovements: mocks.retryAtsImprovements,
  decideAtsImprovement: mocks.decideAtsImprovement,
  completeAtsImprovements: mocks.completeAtsImprovements,
  setAtsImprovedVersionActive: mocks.setAtsImprovedVersionActive,
  downloadTailoredResume: mocks.downloadResume,
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

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses evidence-aware ATS alignment headlines", () => {
    expect(atsAlignmentHeadline(85)).toBe("strong alignment");
    expect(atsAlignmentHeadline(65)).toBe("moderate alignment");
    expect(atsAlignmentHeadline(35)).toBe("weak alignment");
  });

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

  it("renders a saved ATS snapshot with transparent missing evidence", async () => {
    mocks.getTailoring.mockResolvedValue({
      id: "tailor_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: "Engineer",
      company: "Acme",
      status: "completed",
      failureMessage: null,
      suggestions: [],
      evidenceClaims: [],
      analysis: { summary: "One", requirements: [], matches: [] },
      tailoredVersionId: "version_tailored",
      finalClaims: [],
      revision: 1,
      atsStatus: "completed",
      atsFailureMessage: null,
      atsSnapshot: {
        tailoredVersionId: "version_tailored",
        overallScore: 82,
        categories: [
          ["keyword_coverage", "Keyword coverage"],
          ["skill_alignment", "Skill alignment"],
          ["experience_relevance", "Experience relevance"],
          ["section_completeness", "Section completeness"],
          ["structure_readability", "Structure & readability"],
          ["formatting_compatibility", "Formatting compatibility"],
        ].map(([category, label]) => ({
          category,
          label,
          score: 82,
          explanation: "Transparent explanation.",
        })),
        findings: [
          {
            id: "ats_1",
            type: "missing",
            title: "Mentoring",
            explanation: "No verified evidence supports this requirement.",
            requirementIds: ["req_1"],
            resumeClaimIds: [],
          },
        ],
        analyzedAt: "2026-10-03T00:00:00.000Z",
        methodologyVersion: "transparent-ats-v1",
      },
      atsImprovementStatus: "not_started",
      atsImprovementFailureMessage: null,
      atsImprovementSuggestions: [],
      atsImprovedVersionId: null,
      atsImprovedClaims: null,
      atsImprovedSnapshot: null,
      atsImprovementActive: false,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    render(<AtsAnalysisPage />);
    expect(
      await screen.findByLabelText("Compatibility score 82 out of 100"),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Mentoring" })).toBeTruthy();
    expect(screen.getByText(/nothing will be invented/i)).toBeTruthy();
    expect(mocks.startAts).not.toHaveBeenCalled();
  });

  it("restores saved custom ATS wording before accepting again", async () => {
    const session = {
      id: "tailor_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: "Engineer",
      company: "Acme",
      status: "completed",
      failureMessage: null,
      suggestions: [],
      evidenceClaims: verification.claims,
      analysis: { summary: "One", requirements: [], matches: [] },
      tailoredVersionId: "version_tailored",
      finalClaims: verification.claims,
      revision: 4,
      atsStatus: "completed",
      atsFailureMessage: null,
      atsSnapshot: {
        tailoredVersionId: "version_tailored",
        overallScore: 68,
        categories: [
          "keyword_coverage",
          "skill_alignment",
          "experience_relevance",
          "section_completeness",
          "structure_readability",
          "formatting_compatibility",
        ].map((category) => ({
          category,
          label: category,
          score: 68,
          explanation: "Transparent explanation.",
        })),
        findings: [],
        analyzedAt: "2026-10-05T00:00:00.000Z",
        methodologyVersion: "transparent-ats-v1",
      },
      atsImprovementStatus: "review",
      atsImprovementFailureMessage: null,
      atsImprovementSuggestions: [
        {
          id: "suggestion_ats_1",
          sourceClaimId: "claim_1",
          requirementIds: ["req_1"],
          section: "experience",
          originalText: "Built APIs.",
          suggestedText: "Built REST APIs.",
          reason: "Uses the supported role language.",
          status: "accepted",
          editedText: "Built secure REST APIs.",
        },
      ],
      atsImprovedVersionId: null,
      atsImprovedClaims: null,
      atsImprovedSnapshot: null,
      atsImprovementActive: false,
      createdAt: "2026-10-05T00:00:00.000Z",
      updatedAt: "2026-10-05T00:00:00.000Z",
    };
    mocks.getTailoring.mockResolvedValue(session);
    mocks.decideAtsImprovement.mockResolvedValue({
      ...session,
      revision: 5,
      atsImprovementSuggestions: [
        {
          ...session.atsImprovementSuggestions[0],
          status: "accepted",
          editedText: "Built secure REST APIs.",
        },
      ],
    });
    render(<AtsAnalysisPage />);

    const editor = await screen.findByLabelText("Edit experience improvement");
    expect((editor as HTMLTextAreaElement).value).toBe(
      "Built secure REST APIs.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Accept wording" }));

    await waitFor(() =>
      expect(mocks.decideAtsImprovement).toHaveBeenCalledWith(
        session,
        "suggestion_ats_1",
        "accepted",
        "Built secure REST APIs.",
      ),
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

  it("starts the durable tailoring workflow from a completed match", async () => {
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
        summary: "One.",
        requirements: [
          {
            id: "req_1",
            category: "skill",
            priority: "required",
            label: "Design systems",
            sourceQuote: "Design systems",
          },
        ],
        matches: [
          {
            requirementId: "req_1",
            status: "strong",
            resumeClaimIds: ["claim_1"],
            explanation: "Direct.",
          },
        ],
      },
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    mocks.createTailoring.mockResolvedValue({ id: "tailor_1" });
    render(<MatchOverview />);
    fireEvent.click(
      await screen.findByRole("button", { name: /Continue to suggestions/ }),
    );
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/tailoring/tailor_1"),
    );
  });

  it("requires every suggestion decision before creating a tailored version", async () => {
    mocks.params.tailoringSessionId = "tailor_1";
    const session = {
      id: "tailor_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: "Product Designer",
      company: "Acme",
      status: "review",
      failureMessage: null,
      evidenceClaims: verification.claims,
      analysis: {
        summary: "One.",
        requirements: [
          {
            id: "req_1",
            category: "skill",
            priority: "required",
            label: "Design systems",
            sourceQuote: "Design systems",
          },
        ],
        matches: [
          {
            requirementId: "req_1",
            status: "strong",
            resumeClaimIds: ["claim_1"],
            explanation: "Direct.",
          },
        ],
      },
      suggestions: [
        {
          id: "suggestion_1",
          sourceClaimId: "claim_1",
          requirementIds: ["req_1"],
          section: "skills",
          originalText: "Led design-system work.",
          suggestedText: "Led design systems across products.",
          reason: "Matches the role wording.",
          status: "pending",
          editedText: null,
        },
      ],
      tailoredVersionId: null,
      finalClaims: null,
      revision: 2,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    };
    mocks.getTailoring.mockResolvedValue(session);
    mocks.decideSuggestion.mockResolvedValue({
      ...session,
      revision: 3,
      suggestions: [{ ...session.suggestions[0], status: "accepted" }],
    });
    render(<TailoringSessionPage />);
    const finish = await screen.findByRole("button", {
      name: /Create tailored version/,
    });
    expect((finish as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "✓ Accept" }));
    await waitFor(() => expect(mocks.decideSuggestion).toHaveBeenCalled());
    expect(
      (
        screen.getByRole("button", {
          name: /Create tailored version/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  });

  it("keeps polling after a transient request failure", async () => {
    vi.useFakeTimers();
    const queued = {
      id: "tailor_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: "Product Designer",
      company: "Acme",
      status: "queued",
      failureMessage: null,
      evidenceClaims: verification.claims,
      analysis: {
        summary: "One.",
        requirements: [
          {
            id: "req_1",
            category: "skill",
            priority: "required",
            label: "Design systems",
            sourceQuote: "Design systems",
          },
        ],
        matches: [
          {
            requirementId: "req_1",
            status: "strong",
            resumeClaimIds: ["claim_1"],
            explanation: "Direct.",
          },
        ],
      },
      suggestions: [],
      tailoredVersionId: null,
      finalClaims: null,
      revision: 0,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    };
    const review = {
      ...queued,
      status: "review",
      revision: 2,
      suggestions: [
        {
          id: "suggestion_1",
          sourceClaimId: "claim_1",
          requirementIds: ["req_1"],
          section: "skills",
          originalText: "Led design-system work.",
          suggestedText: "Led design systems across products.",
          reason: "Relevant.",
          status: "pending",
          editedText: null,
        },
      ],
    };
    mocks.getTailoring
      .mockResolvedValueOnce(queued)
      .mockRejectedValueOnce(new Error("Temporary network error"))
      .mockResolvedValue(review);
    render(<TailoringSessionPage />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/creating conservative suggestions/i)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });
    expect(screen.getByText(/keep trying automatically/i)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(2_500);
      await Promise.resolve();
    });
    expect(screen.getByText("Led design-system work.")).toBeTruthy();
  });

  it("disables redundant acceptance after manual wording is saved", async () => {
    mocks.getTailoring.mockResolvedValue({
      id: "tailor_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: "Product Designer",
      company: "Acme",
      status: "review",
      failureMessage: null,
      evidenceClaims: verification.claims,
      analysis: {
        summary: "One.",
        requirements: [
          {
            id: "req_1",
            category: "skill",
            priority: "required",
            label: "Design systems",
            sourceQuote: "Design systems",
          },
        ],
        matches: [
          {
            requirementId: "req_1",
            status: "strong",
            resumeClaimIds: ["claim_1"],
            explanation: "Direct.",
          },
        ],
      },
      suggestions: [
        {
          id: "suggestion_1",
          sourceClaimId: "claim_1",
          requirementIds: ["req_1"],
          section: "skills",
          originalText: "Led design-system work.",
          suggestedText: "Led design systems across products.",
          reason: "Relevant.",
          status: "accepted",
          editedText: "Led accessible design systems across products.",
        },
      ],
      tailoredVersionId: null,
      finalClaims: null,
      revision: 3,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    render(<TailoringSessionPage />);
    const accepted = await screen.findByRole("button", {
      name: "✓ Accepted",
    });
    expect((accepted as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText("Led accessible design systems across products."),
    ).toBeTruthy();
  });

  it("previews the professional template and exports the selected density", async () => {
    const session = {
      id: "tailor_1",
      jobDescriptionId: "jd_1",
      resumeId: "resume_1",
      resumeVersionId: "version_1",
      role: "Product Designer",
      company: "Acme",
      status: "completed",
      failureMessage: null,
      evidenceClaims: verification.claims,
      analysis: { summary: "One.", requirements: [], matches: [] },
      suggestions: [
        {
          id: "suggestion_1",
          sourceClaimId: "claim_experience",
          requirementIds: ["req_1"],
          section: "experience",
          originalText: "Led design-system work.",
          suggestedText: "Led accessible design systems.",
          reason: "Relevant.",
          status: "accepted",
          editedText: null,
        },
      ],
      tailoredVersionId: "version_tailored",
      finalClaims: [
        {
          id: "claim_personal",
          category: "personal_info",
          label: "Contact information",
          value: "Alex Mercer | alex@example.com",
          sourceText: null,
          pageNumber: 1,
          status: "confirmed",
          userAdded: false,
          order: 0,
        },
        {
          id: "claim_experience",
          category: "experience",
          label: "Lead Product Designer at Northstar",
          value: "Led accessible design systems.",
          sourceText: null,
          pageNumber: 1,
          status: "edited",
          userAdded: false,
          order: 1,
        },
      ],
      revision: 4,
      atsStatus: "not_started",
      atsFailureMessage: null,
      atsSnapshot: null,
      createdAt: "2026-10-03T00:00:00.000Z",
      updatedAt: "2026-10-03T00:00:00.000Z",
    };
    mocks.getTailoring.mockResolvedValue(session);
    mocks.downloadResume.mockResolvedValue({
      blob: new Blob(["resume"]),
      filename: "acme-resume.docx",
    });
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:resume");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickDownload = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<ResumeDocumentPage />);

    expect(
      await screen.findByRole("heading", { name: "Alex Mercer" }),
    ).toBeTruthy();
    expect(screen.getByText("Led accessible design systems.")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Compact/));
    fireEvent.click(
      screen.getByRole("button", { name: "Download editable DOCX" }),
    );
    await waitFor(() =>
      expect(mocks.downloadResume).toHaveBeenCalledWith(
        "tailor_1",
        "docx",
        "compact",
      ),
    );
    expect(createObjectUrl).toHaveBeenCalled();
    expect(clickDownload).toHaveBeenCalled();
  });
});
