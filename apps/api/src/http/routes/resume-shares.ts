import {
  updateResumeShareRequestSchema,
  type PublicResumeShare,
  type ResumeShare,
} from "@make-my-resume/contracts";
import { buildProfessionalResumeDocument } from "@make-my-resume/resume-engine";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";
import type { ResumeObjectStorage } from "../../infrastructure/storage/r2-object-storage.js";
import type { ResumeImportRepository } from "../../modules/resumes/resume-import-repository.js";
import type {
  ResumeShareRecord,
  ResumeShareRepository,
} from "../../modules/resumes/resume-share-repository.js";
import type {
  ResumeVersionRecord,
  ResumeVersionRepository,
} from "../../modules/resumes/resume-version-repository.js";
import {
  createMemoryPublicResumeExportCache,
  createMemoryPublicResumeExportRateLimiter,
  createMemoryPublicResumePreviewCache,
  createMemoryPublicResumeRateLimiter,
  invalidPublicResumeRequestsPerMinute,
  publicResumePreviewRequestsPerMinute,
  type PublicResumeExportCache,
  type PublicResumeExportRateLimiter,
  type PublicResumePreviewCache,
} from "../../modules/resumes/public-resume-export-protection.js";
import {
  attachContactLinksToClaims,
  attachProjectLinksToClaims,
  renderProfessionalResume,
} from "../../modules/tailoring/resume-export-service.js";

export interface ResumeShareRouteServices {
  repository: ResumeShareRepository;
  resumeVersionRepository: ResumeVersionRepository;
  resumeImportRepository: ResumeImportRepository;
  objectStorage?: ResumeObjectStorage | null;
  publicExportCache?: PublicResumeExportCache;
  publicExportRateLimiter?: PublicResumeExportRateLimiter;
  publicPreviewCache?: PublicResumePreviewCache;
  publicPreviewRateLimiter?: PublicResumeExportRateLimiter;
  invalidPublicRequestRateLimiter?: PublicResumeExportRateLimiter;
}

const shareTokenPattern = /^[A-Za-z0-9_-]{43}$/;

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  response.status(status).json({ error: { code, message } });
}

function serializeShare(record: ResumeShareRecord): ResumeShare {
  return {
    id: record.id,
    resumeId: record.resumeId,
    versionId: record.versionId,
    token: record.token,
    enabled: record.enabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function downloadName(record: ResumeVersionRecord) {
  const normalized = record.name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("en")
    .slice(0, 80);
  return `${normalized || "shared-resume"}.pdf`;
}

function unavailable(response: Response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  return sendError(
    response,
    404,
    "SHARE_UNAVAILABLE",
    "This private resume link is unavailable.",
  );
}

export function createResumeShareRouter(
  auth: Auth,
  services: ResumeShareRouteServices,
) {
  const router = Router();
  const publicExportCache =
    services.publicExportCache ?? createMemoryPublicResumeExportCache();
  const publicExportRateLimiter =
    services.publicExportRateLimiter ??
    createMemoryPublicResumeExportRateLimiter();
  const publicPreviewCache =
    services.publicPreviewCache ?? createMemoryPublicResumePreviewCache();
  const publicPreviewRateLimiter =
    services.publicPreviewRateLimiter ??
    createMemoryPublicResumeRateLimiter(publicResumePreviewRequestsPerMinute);
  const invalidPublicRequestRateLimiter =
    services.invalidPublicRequestRateLimiter ??
    createMemoryPublicResumeRateLimiter(invalidPublicResumeRequestsPerMinute);

  async function requireUser(request: Request, response: Response) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) {
      sendError(response, 401, "UNAUTHORIZED", "Authentication is required.");
      return null;
    }
    return session.user.id;
  }

  async function requireOwnedVersion(
    userId: string,
    resumeId: string,
    versionId: string,
    response: Response,
  ) {
    const version = await services.resumeVersionRepository.findOwned(
      userId,
      resumeId,
      versionId,
    );
    if (!version) {
      sendError(
        response,
        404,
        "VERSION_NOT_FOUND",
        "Resume version was not found.",
      );
      return null;
    }
    return version;
  }

  async function resolvePublicVersion(token: string) {
    if (!shareTokenPattern.test(token)) return null;
    const share = await services.repository.findEnabledByToken(token);
    if (!share) return null;
    const version = await services.resumeVersionRepository.findOwned(
      share.userId,
      share.resumeId,
      share.versionId,
    );
    return version ? { share, version } : null;
  }

  function clientIp(request: Request) {
    return request.ip ?? request.socket.remoteAddress ?? "unknown";
  }

  function rateLimited(
    response: Response,
    retryAfterSeconds: number,
    code: string,
    message: string,
  ) {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Retry-After", String(retryAfterSeconds));
    return sendError(response, 429, code, message);
  }

  async function resolveRateLimitedPublicVersion(
    request: Request,
    response: Response,
    limiter: PublicResumeExportRateLimiter,
    code: string,
    message: string,
  ) {
    const rawToken = request.params.shareToken;
    const token = Array.isArray(rawToken) ? "" : (rawToken ?? "");
    const resolved = await resolvePublicVersion(token);
    if (!resolved) {
      const invalidLimit = invalidPublicRequestRateLimiter.consume(
        "invalid-share",
        clientIp(request),
      );
      if (!invalidLimit.allowed) {
        rateLimited(
          response,
          invalidLimit.retryAfterSeconds,
          "PUBLIC_SHARE_RATE_LIMITED",
          "Too many private link requests. Please wait before trying again.",
        );
        return null;
      }
      unavailable(response);
      return null;
    }

    const limit = limiter.consume(resolved.share.token, clientIp(request));
    if (!limit.allowed) {
      rateLimited(response, limit.retryAfterSeconds, code, message);
      return null;
    }
    return resolved;
  }

  const ownerPath = "/api/v1/resumes/:resumeId/versions/:versionId/share";

  router.get(ownerPath, async (request, response, next) => {
    try {
      const userId = await requireUser(request, response);
      if (!userId) return;
      const version = await requireOwnedVersion(
        userId,
        request.params.resumeId,
        request.params.versionId,
        response,
      );
      if (!version) return;
      const record = await services.repository.findOwnedForVersion(
        userId,
        version.resumeId,
        version.id,
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json({
        data: record ? serializeShare(record) : null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post(ownerPath, async (request, response, next) => {
    try {
      const userId = await requireUser(request, response);
      if (!userId) return;
      const version = await requireOwnedVersion(
        userId,
        request.params.resumeId,
        request.params.versionId,
        response,
      );
      if (!version) return;
      const existing = await services.repository.findOwnedForVersion(
        userId,
        version.resumeId,
        version.id,
      );
      const record = await services.repository.createOwned(
        userId,
        version.resumeId,
        version.id,
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.status(existing ? 200 : 201).json({
        data: serializeShare(record),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch(ownerPath, async (request, response, next) => {
    try {
      const userId = await requireUser(request, response);
      if (!userId) return;
      const parsed = updateResumeShareRequestSchema.safeParse(request.body);
      if (!parsed.success)
        return sendError(
          response,
          400,
          "INVALID_SHARE_STATE",
          "Choose whether this private link should be enabled.",
        );
      const version = await requireOwnedVersion(
        userId,
        request.params.resumeId,
        request.params.versionId,
        response,
      );
      if (!version) return;
      const record = await services.repository.setEnabledOwned(
        userId,
        version.resumeId,
        version.id,
        parsed.data.enabled,
      );
      if (!record)
        return sendError(
          response,
          404,
          "SHARE_NOT_FOUND",
          "Create a private link before changing its status.",
        );
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json({ data: serializeShare(record) });
    } catch (error) {
      next(error);
    }
  });

  router.post(`${ownerPath}/regenerate`, async (request, response, next) => {
    try {
      const userId = await requireUser(request, response);
      if (!userId) return;
      const version = await requireOwnedVersion(
        userId,
        request.params.resumeId,
        request.params.versionId,
        response,
      );
      if (!version) return;
      const record = await services.repository.regenerateOwned(
        userId,
        version.resumeId,
        version.id,
      );
      if (!record)
        return sendError(
          response,
          404,
          "SHARE_NOT_FOUND",
          "Create a private link before regenerating it.",
        );
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json({ data: serializeShare(record) });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/v1/public/resumes/:shareToken",
    async (request, response, next) => {
      try {
        const resolved = await resolveRateLimitedPublicVersion(
          request,
          response,
          publicPreviewRateLimiter,
          "PUBLIC_PREVIEW_RATE_LIMITED",
          "Too many preview requests. Please wait before trying again.",
        );
        if (!resolved) return;
        const data = await publicPreviewCache.getOrCreate(
          `${resolved.version.id}:${resolved.version.updatedAt.toISOString()}`,
          async (): Promise<PublicResumeShare> => {
            const claims = attachContactLinksToClaims(
              attachProjectLinksToClaims(resolved.version.claims),
            );
            return {
              versionName: resolved.version.name,
              document: buildProfessionalResumeDocument(claims),
              presentation: resolved.version.presentation,
              updatedAt: resolved.version.updatedAt.toISOString(),
            };
          },
        );
        response.setHeader("Cache-Control", "no-store, max-age=0");
        response.status(200).json({ data });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/v1/public/resumes/:shareToken/export",
    async (request, response, next) => {
      try {
        const resolved = await resolveRateLimitedPublicVersion(
          request,
          response,
          publicExportRateLimiter,
          "PUBLIC_EXPORT_RATE_LIMITED",
          "Too many download requests. Please wait before trying again.",
        );
        if (!resolved) return;
        const exported = await publicExportCache.getOrCreate(
          `${resolved.version.id}:${resolved.version.updatedAt.toISOString()}`,
          async () => {
            const exportClaims = attachContactLinksToClaims(
              attachProjectLinksToClaims(resolved.version.claims),
            );
            return renderProfessionalResume(
              buildProfessionalResumeDocument(exportClaims),
              "pdf",
              resolved.version.presentation,
            );
          },
        );
        response.setHeader("Cache-Control", "no-store, max-age=0");
        response.setHeader("Content-Type", exported.contentType);
        response.setHeader(
          "Content-Disposition",
          `attachment; filename="${downloadName(resolved.version)}"`,
        );
        response.setHeader("Content-Length", String(exported.bytes.length));
        response.send(exported.bytes);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
