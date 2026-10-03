import {
  updateResumeVerificationRequestSchema,
  type ResumeClaim,
  type ResumeVerification,
} from "@make-my-resume/contracts";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";
import type { ResumeExtractionRepository } from "../../modules/resumes/resume-extraction-repository.js";
import { createId } from "../../shared/ids/create-id.js";

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  response.status(status).json({ error: { code, message } });
}

function serialize(
  record: NonNullable<
    Awaited<ReturnType<ResumeExtractionRepository["findOwned"]>>
  >,
): ResumeVerification {
  return {
    resumeId: record.resumeId,
    versionId: record.versionId,
    jobId: record.id,
    status: record.status,
    progress: record.progress,
    failureMessage: record.failureMessage,
    claims: record.claims,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function createResumeVerificationRouter(
  auth: Auth,
  repository: ResumeExtractionRepository,
) {
  const router = Router();

  async function authenticatedUserId(request: Request) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    return session?.user.id ?? null;
  }

  router.get(
    "/api/v1/resumes/:resumeId/verification",
    async (request, response, next) => {
      try {
        const userId = await authenticatedUserId(request);
        if (!userId) {
          sendError(
            response,
            401,
            "UNAUTHORIZED",
            "Authentication is required.",
          );
          return;
        }
        const record = await repository.findOwned(
          userId,
          request.params.resumeId,
        );
        if (!record) {
          sendError(
            response,
            404,
            "VERIFICATION_NOT_FOUND",
            "Resume verification was not found.",
          );
          return;
        }
        response.status(200).json({ data: serialize(record) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/api/v1/resumes/:resumeId/verification",
    async (request, response, next) => {
      try {
        const userId = await authenticatedUserId(request);
        if (!userId) {
          sendError(
            response,
            401,
            "UNAUTHORIZED",
            "Authentication is required.",
          );
          return;
        }
        const parsed = updateResumeVerificationRequestSchema.safeParse(
          request.body,
        );
        if (!parsed.success) {
          sendError(
            response,
            400,
            "INVALID_CLAIMS",
            parsed.error.issues[0]?.message ?? "Invalid claims.",
          );
          return;
        }
        const existing = await repository.findOwned(
          userId,
          request.params.resumeId,
        );
        if (
          !existing ||
          !["review_required", "verified"].includes(existing.status)
        ) {
          sendError(
            response,
            409,
            "VERIFICATION_NOT_READY",
            "This resume is not ready for review.",
          );
          return;
        }
        const existingClaims = new Map(
          existing.claims.map((claim) => [claim.id, claim]),
        );
        const seen = new Set<string>();
        const claims: ResumeClaim[] = parsed.data.claims.map((claim, order) => {
          const source = existingClaims.get(claim.id);
          const id =
            source && !seen.has(source.id) ? source.id : createId("claim");
          seen.add(id);
          const valueChanged =
            source &&
            (source.value !== claim.value || source.label !== claim.label);
          return {
            ...claim,
            id,
            order,
            sourceText: source?.sourceText ?? null,
            pageNumber: source?.pageNumber ?? null,
            userAdded: source?.userAdded ?? true,
            status:
              valueChanged && claim.status === "confirmed"
                ? "edited"
                : claim.status,
          };
        });
        const updated = await repository.updateClaims(
          userId,
          request.params.resumeId,
          claims,
          existing.revision ?? 0,
        );
        if (!updated) {
          sendError(
            response,
            409,
            "VERIFICATION_STATE_CHANGED",
            "The verification changed while it was being saved.",
          );
          return;
        }
        response.status(200).json({ data: serialize(updated) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/resumes/:resumeId/extraction/retry",
    async (request, response, next) => {
      try {
        const userId = await authenticatedUserId(request);
        if (!userId) {
          sendError(
            response,
            401,
            "UNAUTHORIZED",
            "Authentication is required.",
          );
          return;
        }
        const record = await repository.retry(userId, request.params.resumeId);
        if (!record) {
          sendError(
            response,
            409,
            "EXTRACTION_NOT_RETRYABLE",
            "This extraction cannot be retried.",
          );
          return;
        }
        response.status(202).json({ data: serialize(record) });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
