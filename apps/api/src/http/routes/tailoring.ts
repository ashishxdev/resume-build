import {
  completeTailoringSessionRequestSchema,
  resumeExportOptionsSchema,
  type TailoringSession,
  updateTailoringSuggestionRequestSchema,
} from "@make-my-resume/contracts";
import { buildProfessionalResumeDocument } from "@make-my-resume/resume-engine";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";
import type { JobAnalysisRateLimiter } from "../../modules/job-descriptions/job-analysis-rate-limiter.js";
import type { JobDescriptionRepository } from "../../modules/job-descriptions/job-description-repository.js";
import type { ResumeObjectStorage } from "../../infrastructure/storage/r2-object-storage.js";
import type { ResumeImportRepository } from "../../modules/resumes/resume-import-repository.js";
import {
  analyzeAts,
  hasImprovedRequirementCoverage,
} from "../../modules/tailoring/ats-analysis-service.js";
import {
  applySuggestionDecisions,
  TailoringConcurrencyError,
  type TailoringRepository,
  type TailoringSessionRecord,
} from "../../modules/tailoring/tailoring-repository.js";
import {
  extractPdfLiveLinks,
  renderProfessionalResume,
} from "../../modules/tailoring/resume-export-service.js";
import { createId } from "../../shared/ids/create-id.js";

export interface TailoringRouteServices {
  repository: TailoringRepository;
  jobDescriptionRepository: JobDescriptionRepository;
  rateLimiter: JobAnalysisRateLimiter;
  resumeImportRepository?: ResumeImportRepository;
  objectStorage?: ResumeObjectStorage | null;
}

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  response.status(status).json({ error: { code, message } });
}

function numericTokens(value: string) {
  return new Set(value.match(/\b\d+(?:[.,]\d+)?%?\b/g) ?? []);
}

function downloadName(record: TailoringSessionRecord, extension: string) {
  const subject = record.company ?? record.role ?? "tailored-resume";
  const normalized = subject
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("en")
    .slice(0, 80);
  return `${normalized || "tailored-resume"}-resume.${extension}`;
}

function serialize(record: TailoringSessionRecord): TailoringSession {
  return {
    id: record.id,
    jobDescriptionId: record.jobDescriptionId,
    resumeId: record.resumeId,
    resumeVersionId: record.resumeVersionId,
    role: record.role,
    company: record.company,
    status: record.status,
    failureMessage: record.failureMessage,
    suggestions: record.suggestions,
    evidenceClaims: record.evidenceClaims,
    analysis: record.analysis,
    tailoredVersionId: record.tailoredVersionId,
    finalClaims: record.finalClaims,
    atsStatus: record.atsStatus ?? "not_started",
    atsFailureMessage: record.atsFailureMessage ?? null,
    atsSnapshot: record.atsSnapshot ?? null,
    atsImprovementStatus: record.atsImprovementStatus ?? "not_started",
    atsImprovementFailureMessage: record.atsImprovementFailureMessage ?? null,
    atsImprovementSuggestions: record.atsImprovementSuggestions ?? [],
    atsImprovedVersionId: record.atsImprovedVersionId ?? null,
    atsImprovedClaims: record.atsImprovedClaims ?? null,
    atsImprovedSnapshot: record.atsImprovedSnapshot ?? null,
    atsImprovementActive: record.atsImprovementActive ?? false,
    revision: record.revision,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function createTailoringRouter(
  auth: Auth,
  services: TailoringRouteServices,
) {
  const router = Router();
  async function userId(request: Request) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    return session?.user.id ?? null;
  }
  async function requireUser(request: Request, response: Response) {
    const id = await userId(request);
    if (!id)
      sendError(response, 401, "UNAUTHORIZED", "Authentication is required.");
    return id;
  }

  router.post(
    "/api/v1/job-descriptions/:id/tailoring-sessions",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const job = await services.jobDescriptionRepository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!job)
          return sendError(
            response,
            404,
            "JOB_DESCRIPTION_NOT_FOUND",
            "Job description was not found.",
          );
        if (job.status !== "completed" || !job.analysis)
          return sendError(
            response,
            409,
            "COMPLETED_ANALYSIS_REQUIRED",
            "Complete the match analysis before generating suggestions.",
          );
        const existing = await services.repository.findOwnedByJobDescription(
          ownerId,
          job.id,
        );
        if (existing)
          return response.status(200).json({ data: serialize(existing) });
        const quota = await services.rateLimiter.consume(
          ownerId,
          undefined,
          `tailoring:${job.id}`,
        );
        if (!quota.allowed) {
          response.setHeader("Retry-After", String(quota.retryAfterSeconds));
          return sendError(
            response,
            429,
            "AI_TAILORING_RATE_LIMITED",
            "You have reached the hourly AI limit. Try again later.",
          );
        }
        const record = await services.repository.create({
          userId: ownerId,
          jobDescriptionId: job.id,
          resumeId: job.resumeId,
          resumeVersionId: job.resumeVersionId,
          role: job.role,
          company: job.company,
          rawJobDescription: job.rawText,
          analysis: job.analysis,
          evidenceClaims: job.evidenceClaims,
        });
        response
          .status(["review", "completed"].includes(record.status) ? 200 : 202)
          .json({ data: serialize(record) });
      } catch (error) {
        if (error instanceof TailoringConcurrencyError)
          return sendError(
            response,
            409,
            "TAILORING_ALREADY_ACTIVE",
            "Another tailoring session is already in progress.",
          );
        next(error);
      }
    },
  );

  router.get(
    "/api/v1/tailoring-sessions/:id",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const record = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!record)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        response.json({ data: serialize(record) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/api/v1/tailoring-sessions/:id",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const deleted = await services.repository.deleteOwned(
          ownerId,
          request.params.id,
        );
        if (!deleted)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/v1/tailoring-sessions/:id/export",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const parsed = resumeExportOptionsSchema.safeParse({
          format: request.query.format,
          density: request.query.density ?? "comfortable",
        });
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_EXPORT_OPTIONS",
            "Choose PDF or DOCX and a supported layout density.",
          );
        const record = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!record)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        if (
          record.status !== "completed" ||
          !record.tailoredVersionId ||
          !record.finalClaims
        )
          return sendError(
            response,
            409,
            "TAILORED_VERSION_REQUIRED",
            "Complete the tailored version before exporting it.",
          );
        const exportClaims =
          record.atsImprovementActive && record.atsImprovedClaims
            ? record.atsImprovedClaims
            : record.finalClaims;
        const tailoredClaimIds = record.suggestions
          .filter((suggestion) => suggestion.status === "accepted")
          .map((suggestion) => suggestion.sourceClaimId);
        const document = buildProfessionalResumeDocument(exportClaims, {
          tailoredClaimIds,
        });
        let sourceProjectLinks: string[] = [];
        if (
          parsed.data.format === "pdf" &&
          services.resumeImportRepository &&
          services.objectStorage
        ) {
          const sourceImport =
            await services.resumeImportRepository.findOwnedByResumeId(
              ownerId,
              record.resumeId,
            );
          if (sourceImport?.mimeType === "application/pdf") {
            const sourceBytes = await services.objectStorage.readObject(
              sourceImport.objectKey,
            );
            sourceProjectLinks = await extractPdfLiveLinks(sourceBytes);
          }
        }
        const exported = await renderProfessionalResume(
          document,
          parsed.data.format,
          parsed.data.density,
          sourceProjectLinks,
        );
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Content-Type", exported.contentType);
        response.setHeader(
          "Content-Disposition",
          `attachment; filename="${downloadName(record, exported.extension)}"`,
        );
        response.setHeader("Content-Length", String(exported.bytes.length));
        response.send(exported.bytes);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get("/api/v1/tailoring-sessions", async (request, response, next) => {
    try {
      const ownerId = await requireUser(request, response);
      if (!ownerId) return;
      const records = await services.repository.findManyOwned(ownerId);
      response.json({ data: records.map(serialize) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/v1/tailoring-sessions/:id/ats-analysis",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!current)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        if (current.status !== "completed" || !current.tailoredVersionId)
          return sendError(
            response,
            409,
            "TAILORED_VERSION_REQUIRED",
            "Complete the tailored version before running ATS analysis.",
          );
        const record = await services.repository.queueAts(ownerId, current.id);
        if (!record)
          return sendError(
            response,
            409,
            "ATS_STATE_CHANGED",
            "The ATS analysis state changed. Please try again.",
          );
        response
          .status(record.atsStatus === "completed" ? 200 : 202)
          .json({ data: serialize(record) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/tailoring-sessions/:id/ats-analysis/retry",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const record = await services.repository.retryAts(
          ownerId,
          request.params.id,
        );
        if (!record)
          return sendError(
            response,
            409,
            "ATS_NOT_RETRYABLE",
            "This ATS analysis cannot be retried.",
          );
        response.status(202).json({ data: serialize(record) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/tailoring-sessions/:id/ats-improvements",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!current)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        if ((current.atsImprovementStatus ?? "not_started") !== "not_started")
          return response.status(200).json({ data: serialize(current) });
        const eligible = current.atsSnapshot?.findings.some(
          (finding) =>
            finding.type === "can_improve" && finding.resumeClaimIds.length > 0,
        );
        if (!eligible)
          return sendError(
            response,
            409,
            "NO_ELIGIBLE_ATS_IMPROVEMENTS",
            "No evidence-backed ATS improvements are available. Missing requirements remain informational.",
          );
        const quota = await services.rateLimiter.consume(
          ownerId,
          undefined,
          `ats-improvement:${current.id}`,
        );
        if (!quota.allowed) {
          response.setHeader("Retry-After", String(quota.retryAfterSeconds));
          return sendError(
            response,
            429,
            "AI_TAILORING_RATE_LIMITED",
            "You have reached the hourly AI limit. Try again later.",
          );
        }
        const updated = await services.repository.queueAtsImprovement(
          ownerId,
          current.id,
        );
        if (!updated)
          return sendError(
            response,
            409,
            "ATS_IMPROVEMENT_STATE_CHANGED",
            "The ATS improvement state changed. Refresh and try again.",
          );
        response.status(202).json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/tailoring-sessions/:id/ats-improvements/retry",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!current || current.atsImprovementStatus !== "failed")
          return sendError(
            response,
            409,
            "ATS_IMPROVEMENT_NOT_RETRYABLE",
            "These ATS improvements cannot be retried.",
          );
        const quota = await services.rateLimiter.consume(
          ownerId,
          undefined,
          `ats-improvement-retry:${current.id}:${current.revision}`,
        );
        if (!quota.allowed) {
          response.setHeader("Retry-After", String(quota.retryAfterSeconds));
          return sendError(
            response,
            429,
            "AI_TAILORING_RATE_LIMITED",
            "You have reached the hourly AI limit. Try again later.",
          );
        }
        const updated = await services.repository.retryAtsImprovement(
          ownerId,
          current.id,
        );
        if (!updated)
          return sendError(
            response,
            409,
            "ATS_IMPROVEMENT_NOT_RETRYABLE",
            "These ATS improvements cannot be retried.",
          );
        response.status(202).json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/api/v1/tailoring-sessions/:id/ats-improvements/active",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        if (typeof request.body?.active !== "boolean")
          return sendError(
            response,
            400,
            "INVALID_ACTIVE_VERSION",
            "Choose whether to use the original or improved version.",
          );
        const updated = await services.repository.setAtsImprovementActive(
          ownerId,
          request.params.id,
          request.body.active,
        );
        if (!updated)
          return sendError(
            response,
            409,
            "ATS_IMPROVEMENT_STATE_CHANGED",
            "The improved version is unavailable.",
          );
        response.json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/tailoring-sessions/:id/ats-improvements/complete",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const parsed = completeTailoringSessionRequestSchema.safeParse(
          request.body,
        );
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_REVISION",
            "A current revision is required.",
          );
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!current)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        if (
          !current.finalClaims ||
          current.atsImprovementStatus !== "review" ||
          current.atsImprovementSuggestions.some(
            (suggestion) => suggestion.status === "pending",
          )
        )
          return sendError(
            response,
            409,
            "PENDING_ATS_IMPROVEMENT_DECISIONS",
            "Accept or reject every improvement before creating a revised version.",
          );
        if (
          !current.atsImprovementSuggestions.some(
            (suggestion) => suggestion.status === "accepted",
          )
        )
          return sendError(
            response,
            409,
            "NO_ACCEPTED_ATS_IMPROVEMENTS",
            "Accept at least one evidence-backed improvement first.",
          );
        const claims = applySuggestionDecisions(
          current.finalClaims,
          current.atsImprovementSuggestions,
        );
        const finalClaimsById = new Map(
          claims.map((claim) => [claim.id, claim]),
        );
        const requirementsById = new Map(
          current.analysis.requirements.map((requirement) => [
            requirement.id,
            requirement,
          ]),
        );
        const improvedRequirementIds = new Set<string>();
        for (const suggestion of current.atsImprovementSuggestions) {
          if (suggestion.status !== "accepted") continue;
          const finalClaim = finalClaimsById.get(suggestion.sourceClaimId);
          if (!finalClaim) continue;
          for (const requirementId of suggestion.requirementIds) {
            const requirement = requirementsById.get(requirementId);
            if (
              requirement &&
              hasImprovedRequirementCoverage(
                requirement,
                suggestion.originalText,
                finalClaim.value,
              )
            ) {
              improvedRequirementIds.add(requirementId);
            }
          }
        }
        const versionId = createId("version");
        const snapshot = analyzeAts({
          ...current,
          finalClaims: claims,
          tailoredVersionId: versionId,
          analysis: {
            ...current.analysis,
            matches: current.analysis.matches.map((match) =>
              match.status === "partial" &&
              improvedRequirementIds.has(match.requirementId)
                ? { ...match, status: "strong" as const }
                : match,
            ),
          },
        });
        const updated = await services.repository.completeAtsImprovement(
          ownerId,
          current.id,
          parsed.data.revision,
          { claims, versionId, snapshot },
        );
        if (!updated)
          return sendError(
            response,
            409,
            "ATS_IMPROVEMENT_STATE_CHANGED",
            "The improvement review changed. Refresh and try again.",
          );
        response.json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/api/v1/tailoring-sessions/:id/ats-improvements/:suggestionId",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const parsed = updateTailoringSuggestionRequestSchema.safeParse(
          request.body,
        );
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_ATS_IMPROVEMENT_DECISION",
            parsed.error.issues[0]?.message ?? "Enter a valid decision.",
          );
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        const suggestion = current?.atsImprovementSuggestions?.find(
          (candidate) => candidate.id === request.params.suggestionId,
        );
        if (!current || !suggestion)
          return sendError(
            response,
            404,
            "ATS_IMPROVEMENT_NOT_FOUND",
            "ATS improvement was not found.",
          );
        if (parsed.data.editedText) {
          const originalNumbers = numericTokens(suggestion.originalText);
          const introducesNumber = [
            ...numericTokens(parsed.data.editedText),
          ].some((token) => !originalNumbers.has(token));
          if (introducesNumber)
            return sendError(
              response,
              400,
              "UNSUPPORTED_NUMERIC_CLAIM",
              "Edited wording cannot introduce a number that is absent from the verified source.",
            );
        }
        const updated = await services.repository.decideAtsImprovement(
          ownerId,
          current.id,
          suggestion.id,
          parsed.data.revision,
          parsed.data,
        );
        if (!updated)
          return sendError(
            response,
            409,
            "ATS_IMPROVEMENT_STATE_CHANGED",
            "The improvement review changed. Refresh and try again.",
          );
        response.json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/tailoring-sessions/:id/retry",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!current)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        if (current.status !== "failed")
          return sendError(
            response,
            409,
            "TAILORING_NOT_RETRYABLE",
            "This tailoring session cannot be retried.",
          );
        const quota = await services.rateLimiter.consume(ownerId);
        if (!quota.allowed) {
          response.setHeader("Retry-After", String(quota.retryAfterSeconds));
          return sendError(
            response,
            429,
            "AI_TAILORING_RATE_LIMITED",
            "You have reached the hourly AI limit. Try again later.",
          );
        }
        const updated = await services.repository.retry(
          ownerId,
          current.id,
          current.revision,
        );
        if (!updated)
          return sendError(
            response,
            409,
            "TAILORING_STATE_CHANGED",
            "The session changed while retrying.",
          );
        response.status(202).json({ data: serialize(updated) });
      } catch (error) {
        if (error instanceof TailoringConcurrencyError)
          return sendError(
            response,
            409,
            "TAILORING_ALREADY_ACTIVE",
            "Another tailoring session is already in progress.",
          );
        next(error);
      }
    },
  );

  router.patch(
    "/api/v1/tailoring-sessions/:id/suggestions/:suggestionId",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const parsed = updateTailoringSuggestionRequestSchema.safeParse(
          request.body,
        );
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_SUGGESTION_DECISION",
            parsed.error.issues[0]?.message ?? "Enter a valid decision.",
          );
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        const suggestion = current?.suggestions.find(
          (candidate) => candidate.id === request.params.suggestionId,
        );
        if (!current || !suggestion)
          return sendError(
            response,
            404,
            "TAILORING_SUGGESTION_NOT_FOUND",
            "Tailoring suggestion was not found.",
          );
        if (parsed.data.editedText) {
          const originalNumbers = numericTokens(suggestion.originalText);
          const introducesNumber = [
            ...numericTokens(parsed.data.editedText),
          ].some((token) => !originalNumbers.has(token));
          if (introducesNumber)
            return sendError(
              response,
              400,
              "UNSUPPORTED_NUMERIC_CLAIM",
              "Edited wording cannot introduce a number that is absent from the verified source.",
            );
        }
        const updated = await services.repository.decide(
          ownerId,
          request.params.id,
          request.params.suggestionId,
          parsed.data.revision,
          parsed.data,
        );
        if (!updated)
          return sendError(
            response,
            409,
            "TAILORING_STATE_CHANGED",
            "The session changed. Refresh and try again.",
          );
        response.json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/tailoring-sessions/:id/suggestions/:decision",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const decision = request.params.decision;
        if (!["accept-all", "reject-all"].includes(decision))
          return sendError(response, 404, "NOT_FOUND", "Action was not found.");
        const parsed = completeTailoringSessionRequestSchema.safeParse(
          request.body,
        );
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_REVISION",
            "A current revision is required.",
          );
        const updated = await services.repository.decideAll(
          ownerId,
          request.params.id,
          parsed.data.revision,
          decision === "accept-all" ? "accepted" : "rejected",
        );
        if (!updated)
          return sendError(
            response,
            409,
            "TAILORING_STATE_CHANGED",
            "The session changed. Refresh and try again.",
          );
        response.json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/tailoring-sessions/:id/complete",
    async (request, response, next) => {
      try {
        const ownerId = await requireUser(request, response);
        if (!ownerId) return;
        const parsed = completeTailoringSessionRequestSchema.safeParse(
          request.body,
        );
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_REVISION",
            "A current revision is required.",
          );
        const current = await services.repository.findOwned(
          ownerId,
          request.params.id,
        );
        if (!current)
          return sendError(
            response,
            404,
            "TAILORING_SESSION_NOT_FOUND",
            "Tailoring session was not found.",
          );
        if (
          current.suggestions.some(
            (suggestion) => suggestion.status === "pending",
          )
        )
          return sendError(
            response,
            409,
            "PENDING_DECISIONS",
            "Accept or reject every suggestion before creating the tailored version.",
          );
        const completed = await services.repository.complete(
          ownerId,
          current.id,
          parsed.data.revision,
        );
        if (!completed)
          return sendError(
            response,
            409,
            "TAILORING_STATE_CHANGED",
            "The session changed. Refresh and try again.",
          );
        response.json({ data: serialize(completed) });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
