import {
  completeTailoringSessionRequestSchema,
  type TailoringSession,
  updateTailoringSuggestionRequestSchema,
} from "@make-my-resume/contracts";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";
import type { JobAnalysisRateLimiter } from "../../modules/job-descriptions/job-analysis-rate-limiter.js";
import type { JobDescriptionRepository } from "../../modules/job-descriptions/job-description-repository.js";
import {
  TailoringConcurrencyError,
  type TailoringRepository,
  type TailoringSessionRecord,
} from "../../modules/tailoring/tailoring-repository.js";

export interface TailoringRouteServices {
  repository: TailoringRepository;
  jobDescriptionRepository: JobDescriptionRepository;
  rateLimiter: JobAnalysisRateLimiter;
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
