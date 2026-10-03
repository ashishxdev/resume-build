import {
  createJobDescriptionRequestSchema,
  type JobDescription,
} from "@make-my-resume/contracts";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";
import type { JobAnalysisRateLimiter } from "../../modules/job-descriptions/job-analysis-rate-limiter.js";
import {
  JobAnalysisConcurrencyError,
  type JobDescriptionRecord,
  type JobDescriptionRepository,
} from "../../modules/job-descriptions/job-description-repository.js";
import type { ResumeExtractionRepository } from "../../modules/resumes/resume-extraction-repository.js";

export interface JobDescriptionServices {
  repository: JobDescriptionRepository;
  extractionRepository: ResumeExtractionRepository;
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

function serialize(record: JobDescriptionRecord): JobDescription {
  return {
    id: record.id,
    resumeId: record.resumeId,
    resumeVersionId: record.resumeVersionId,
    evidenceClaims: record.evidenceClaims ?? [],
    role: record.role,
    company: record.company,
    rawText: record.rawText,
    status: record.status,
    failureMessage: record.failureMessage,
    analysis: record.analysis,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

async function consumeAnalysisQuota(
  userId: string,
  response: Response,
  limiter: JobAnalysisRateLimiter,
) {
  const result = await limiter.consume(userId);
  if (result.allowed) return true;
  response.setHeader("Retry-After", String(result.retryAfterSeconds));
  sendError(
    response,
    429,
    "AI_ANALYSIS_RATE_LIMITED",
    "You have reached the hourly analysis limit. Try again later.",
  );
  return false;
}

export function createJobDescriptionRouter(
  auth: Auth,
  services: JobDescriptionServices,
) {
  const router = Router();

  async function authenticatedUserId(request: Request) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    return session?.user.id ?? null;
  }

  router.post("/api/v1/job-descriptions", async (request, response, next) => {
    try {
      const userId = await authenticatedUserId(request);
      if (!userId) {
        return sendError(
          response,
          401,
          "UNAUTHORIZED",
          "Authentication is required.",
        );
      }
      const parsed = createJobDescriptionRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return sendError(
          response,
          400,
          "INVALID_JOB_DESCRIPTION",
          parsed.error.issues[0]?.message ?? "Enter a valid job description.",
        );
      }
      const extraction = await services.extractionRepository.findOwned(
        userId,
        parsed.data.resumeId,
      );
      if (extraction?.status !== "verified" || !extraction.versionId) {
        return sendError(
          response,
          409,
          "VERIFIED_RESUME_REQUIRED",
          "Verify this resume before analyzing a job description.",
        );
      }
      if (
        !(await consumeAnalysisQuota(userId, response, services.rateLimiter))
      ) {
        return;
      }
      const record = await services.repository.create({
        userId,
        resumeVersionId: extraction.versionId,
        evidenceClaims: extraction.claims.filter(
          (claim) => claim.status !== "rejected",
        ),
        ...parsed.data,
      });
      response.status(202).json({ data: serialize(record) });
    } catch (error) {
      if (error instanceof JobAnalysisConcurrencyError) {
        return sendError(
          response,
          409,
          "AI_ANALYSIS_ALREADY_ACTIVE",
          "Another job analysis is already in progress. Wait for it to finish before starting a new one.",
        );
      }
      next(error);
    }
  });

  router.get(
    "/api/v1/job-descriptions/:id",
    async (request, response, next) => {
      try {
        const userId = await authenticatedUserId(request);
        if (!userId) {
          return sendError(
            response,
            401,
            "UNAUTHORIZED",
            "Authentication is required.",
          );
        }
        const record = await services.repository.findOwned(
          userId,
          request.params.id,
        );
        if (!record) {
          return sendError(
            response,
            404,
            "JOB_DESCRIPTION_NOT_FOUND",
            "Job description was not found.",
          );
        }
        response.status(200).json({ data: serialize(record) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/job-descriptions/:id/analyze",
    async (request, response, next) => {
      try {
        const userId = await authenticatedUserId(request);
        if (!userId) {
          return sendError(
            response,
            401,
            "UNAUTHORIZED",
            "Authentication is required.",
          );
        }
        const existing = await services.repository.findOwned(
          userId,
          request.params.id,
        );
        if (!existing) {
          return sendError(
            response,
            404,
            "JOB_DESCRIPTION_NOT_FOUND",
            "Job description was not found.",
          );
        }
        if (existing.status !== "failed") {
          return sendError(
            response,
            409,
            "ANALYSIS_NOT_RETRYABLE",
            "This analysis cannot be retried.",
          );
        }
        let evidenceClaims = existing.evidenceClaims;
        if (!evidenceClaims?.length) {
          const extraction = await services.extractionRepository.findOwned(
            userId,
            existing.resumeId,
          );
          if (
            extraction?.status !== "verified" ||
            extraction.versionId !== existing.resumeVersionId
          ) {
            return sendError(
              response,
              409,
              "EVIDENCE_SNAPSHOT_UNAVAILABLE",
              "This older analysis cannot be retried because its verified resume version is no longer current. Start a new analysis instead.",
            );
          }
          evidenceClaims = extraction.claims.filter(
            (claim) => claim.status !== "rejected",
          );
        }
        if (
          !(await consumeAnalysisQuota(userId, response, services.rateLimiter))
        ) {
          return;
        }
        const queued = await services.repository.retry(
          userId,
          existing.id,
          existing.revision,
          evidenceClaims,
        );
        if (!queued) {
          return sendError(
            response,
            409,
            "ANALYSIS_STATE_CHANGED",
            "The analysis changed while retrying.",
          );
        }
        response.status(202).json({ data: serialize(queued) });
      } catch (error) {
        if (error instanceof JobAnalysisConcurrencyError) {
          return sendError(
            response,
            409,
            "AI_ANALYSIS_ALREADY_ACTIVE",
            "Another job analysis is already in progress.",
          );
        }
        next(error);
      }
    },
  );

  return router;
}
