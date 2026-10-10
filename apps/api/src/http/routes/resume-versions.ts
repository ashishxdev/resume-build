import {
  renameResumeVersionRequestSchema,
  resumeExportFormatSchema,
  resumeTemplateDensitySchema,
  updateResumePresentationRequestSchema,
  type ResumeVersion,
  type ResumeVersionList,
  type ResumeVersionSummary,
} from "@make-my-resume/contracts";
import { buildProfessionalResumeDocument } from "@make-my-resume/resume-engine";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";
import type { ResumeObjectStorage } from "../../infrastructure/storage/r2-object-storage.js";
import type { ResumeImportRepository } from "../../modules/resumes/resume-import-repository.js";
import type {
  ResumeVersionCollection,
  ResumeVersionRecord,
  ResumeVersionRepository,
} from "../../modules/resumes/resume-version-repository.js";
import {
  extractPdfLiveLinks,
  renderProfessionalResume,
} from "../../modules/tailoring/resume-export-service.js";

export interface ResumeVersionRouteServices {
  repository: ResumeVersionRepository;
  resumeImportRepository: ResumeImportRepository;
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

function deletionState(
  record: ResumeVersionRecord,
  collection: ResumeVersionCollection,
) {
  if (record.type === "base") {
    return {
      canDelete: false,
      deleteScope: null,
      deleteBlockedReason: "The verified baseline is permanently protected.",
    } as const;
  }
  const group = record.tailoringSessionId
    ? collection.versions.filter(
        (version) => version.tailoringSessionId === record.tailoringSessionId,
      )
    : [record];
  const groupIds = new Set(group.map((version) => version.id));
  if (group.some((version) => version.id === collection.activeVersionId)) {
    return {
      canDelete: false,
      deleteScope: record.tailoringSessionId
        ? ("tailoring_session" as const)
        : ("version" as const),
      deleteBlockedReason: "Activate another version before deleting this one.",
    };
  }
  const referenced = collection.versions.some(
    (version) =>
      !groupIds.has(version.id) &&
      version.sourceVersionId !== null &&
      groupIds.has(version.sourceVersionId),
  );
  if (referenced) {
    return {
      canDelete: false,
      deleteScope: record.tailoringSessionId
        ? ("tailoring_session" as const)
        : ("version" as const),
      deleteBlockedReason:
        "A restored version depends on this snapshot. Delete that copy first.",
    };
  }
  return {
    canDelete: true,
    deleteScope: record.tailoringSessionId
      ? ("tailoring_session" as const)
      : ("version" as const),
    deleteBlockedReason: null,
  };
}

function serializeSummary(
  record: ResumeVersionRecord,
  collection: ResumeVersionCollection,
): ResumeVersionSummary {
  const deletion = deletionState(record, collection);
  return {
    id: record.id,
    resumeId: record.resumeId,
    name: record.name,
    type: record.type,
    versionNumber:
      collection.versions.findIndex((version) => version.id === record.id) + 1,
    sourceVersionId: record.sourceVersionId,
    jobDescriptionId: record.jobDescriptionId,
    tailoringSessionId: record.tailoringSessionId,
    company: record.company,
    role: record.role,
    isActive: collection.activeVersionId === record.id,
    ...deletion,
    presentation: record.presentation,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeVersion(
  record: ResumeVersionRecord,
  collection: ResumeVersionCollection,
): ResumeVersion {
  return {
    ...serializeSummary(record, collection),
    claims: record.claims,
  };
}

function serializeCollection(
  collection: ResumeVersionCollection,
): ResumeVersionList {
  return {
    resumeId: collection.resumeId,
    resumeName: collection.resumeName,
    activeVersionId: collection.activeVersionId,
    versions: collection.versions.map((version) =>
      serializeSummary(version, collection),
    ),
  };
}

function downloadName(record: ResumeVersionRecord, extension: string) {
  const normalized = record.name
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("en")
    .slice(0, 80);
  return `${normalized || "resume-version"}.${extension}`;
}

export function createResumeVersionRouter(
  auth: Auth,
  services: ResumeVersionRouteServices,
) {
  const router = Router();

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

  async function collectionOrError(
    userId: string,
    resumeId: string,
    response: Response,
  ) {
    const collection = await services.repository.listOwned(userId, resumeId);
    if (!collection) {
      sendError(
        response,
        404,
        "RESUME_NOT_FOUND",
        "Resume version history was not found.",
      );
      return null;
    }
    return collection;
  }

  router.get(
    "/api/v1/resumes/:resumeId/versions",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const collection = await collectionOrError(
          userId,
          request.params.resumeId,
          response,
        );
        if (!collection) return;
        response.status(200).json({ data: serializeCollection(collection) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/v1/resumes/:resumeId/versions/:versionId",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const collection = await collectionOrError(
          userId,
          request.params.resumeId,
          response,
        );
        if (!collection) return;
        const record = collection.versions.find(
          (version) => version.id === request.params.versionId,
        );
        if (!record)
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        response.status(200).json({
          data: serializeVersion(record, collection),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/api/v1/resumes/:resumeId/versions/:versionId",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const parsed = renameResumeVersionRequestSchema.safeParse(request.body);
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_VERSION_NAME",
            "Enter a version name between 1 and 120 characters.",
          );
        const updated = await services.repository.renameOwned(
          userId,
          request.params.resumeId,
          request.params.versionId,
          parsed.data.name,
        );
        if (!updated)
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        const collection = await services.repository.listOwned(
          userId,
          request.params.resumeId,
        );
        if (!collection) return;
        response.status(200).json({
          data: serializeVersion(updated, collection),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/api/v1/resumes/:resumeId/versions/:versionId/presentation",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const parsed = updateResumePresentationRequestSchema.safeParse(
          request.body,
        );
        if (!parsed.success)
          return sendError(
            response,
            400,
            "INVALID_PRESENTATION_SETTINGS",
            "Choose supported template, typography, color, spacing, and section settings.",
          );
        const existing = await services.repository.findOwned(
          userId,
          request.params.resumeId,
          request.params.versionId,
        );
        if (!existing)
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        const document = buildProfessionalResumeDocument(existing.claims);
        if (
          document.sections.length > 0 &&
          document.sections.every((section) =>
            parsed.data.hiddenSections.includes(section.kind),
          )
        )
          return sendError(
            response,
            400,
            "ALL_SECTIONS_HIDDEN",
            "Keep at least one resume section visible.",
          );
        const updated = await services.repository.updatePresentationOwned(
          userId,
          request.params.resumeId,
          request.params.versionId,
          parsed.data,
        );
        if (!updated)
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        const collection = await services.repository.listOwned(
          userId,
          request.params.resumeId,
        );
        if (!collection) return;
        response.status(200).json({
          data: serializeVersion(updated, collection),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/resumes/:resumeId/versions/:versionId/activate",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const activated = await services.repository.activateOwned(
          userId,
          request.params.resumeId,
          request.params.versionId,
        );
        if (!activated)
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        response.status(200).json({
          data: { activeVersionId: request.params.versionId },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/api/v1/resumes/:resumeId/versions/:versionId/restore",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const restored = await services.repository.restoreOwned(
          userId,
          request.params.resumeId,
          request.params.versionId,
        );
        if (!restored)
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        const collection = await services.repository.listOwned(
          userId,
          request.params.resumeId,
        );
        if (!collection) return;
        response.status(201).json({
          data: serializeVersion(restored, collection),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/api/v1/resumes/:resumeId/versions/:versionId",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const result = await services.repository.deleteOwned(
          userId,
          request.params.resumeId,
          request.params.versionId,
        );
        if (result.status === "not_found")
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        if (result.status === "base")
          return sendError(
            response,
            409,
            "BASE_VERSION_PROTECTED",
            "The verified baseline cannot be deleted.",
          );
        if (result.status === "active")
          return sendError(
            response,
            409,
            "ACTIVE_VERSION_PROTECTED",
            "Activate another version before deleting this one.",
          );
        if (result.status === "referenced")
          return sendError(
            response,
            409,
            "VERSION_HAS_DEPENDENCIES",
            "Delete restored versions that depend on this snapshot first.",
          );
        response.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/v1/resumes/:resumeId/versions/:versionId/export",
    async (request, response, next) => {
      try {
        const userId = await requireUser(request, response);
        if (!userId) return;
        const format = resumeExportFormatSchema.safeParse(request.query.format);
        const density = resumeTemplateDensitySchema
          .optional()
          .safeParse(request.query.density);
        if (!format.success || !density.success)
          return sendError(
            response,
            400,
            "INVALID_EXPORT_OPTIONS",
            "Choose PDF or DOCX and a supported layout density.",
          );
        const record = await services.repository.findOwned(
          userId,
          request.params.resumeId,
          request.params.versionId,
        );
        if (!record)
          return sendError(
            response,
            404,
            "VERSION_NOT_FOUND",
            "Resume version was not found.",
          );
        const document = buildProfessionalResumeDocument(record.claims);
        const presentation = density.data
          ? { ...record.presentation, density: density.data }
          : record.presentation;
        let sourceProjectLinks: string[] = [];
        if (format.data === "pdf" && services.objectStorage) {
          const sourceImport =
            await services.resumeImportRepository.findOwnedByResumeId(
              userId,
              record.resumeId,
            );
          if (sourceImport?.mimeType === "application/pdf") {
            sourceProjectLinks = await extractPdfLiveLinks(
              await services.objectStorage.readObject(sourceImport.objectKey),
            );
          }
        }
        const exported = await renderProfessionalResume(
          document,
          format.data,
          presentation,
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

  return router;
}
