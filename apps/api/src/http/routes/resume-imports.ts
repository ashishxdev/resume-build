import {
  createResumeImportRequestSchema,
  type ResumeImport,
  type ResumeMimeType,
  type ResumeSourceType,
} from "@make-my-resume/contracts";
import { fromNodeHeaders } from "better-auth/node";
import { Router, type Request, type Response } from "express";

import type { Auth } from "../../infrastructure/auth/auth.js";
import type { ResumeObjectStorage } from "../../infrastructure/storage/r2-object-storage.js";
import type {
  ResumeImportRecord,
  ResumeImportRepository,
} from "../../modules/resumes/resume-import-repository.js";
import type { ResumeExtractionRepository } from "../../modules/resumes/resume-extraction-repository.js";
import { createId } from "../../shared/ids/create-id.js";

export interface ResumeImportServices {
  objectStorage: ResumeObjectStorage | null;
  repository: ResumeImportRepository;
  extractionRepository?: ResumeExtractionRepository;
}

const fileExtensions: Record<ResumeMimeType, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

function isSupportedMimeType(value: string): value is ResumeMimeType {
  return Object.hasOwn(fileExtensions, value);
}

function expectedSourceType(mimeType: ResumeMimeType): ResumeSourceType {
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "docx";
}

function resumeName(fileName: string) {
  const name = fileName.replace(/\.[^.]+$/, "").trim();
  return (name || "Imported resume").slice(0, 120);
}

function serializeImport(record: ResumeImportRecord): ResumeImport {
  return {
    id: record.id,
    resumeId: record.resumeId,
    fileId: record.fileId,
    fileName: record.fileName,
    mimeType: record.mimeType,
    size: record.size,
    sourceType: record.sourceType,
    status: record.status,
    failureCode: record.failureCode,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function sendError(
  response: Response,
  status: number,
  code: string,
  message: string,
) {
  response.status(status).json({ error: { code, message } });
}

export function createResumeImportRouter(
  auth: Auth,
  services: ResumeImportServices,
) {
  const router = Router();

  async function authenticatedUserId(request: Request) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    return session?.user.id ?? null;
  }

  router.get("/api/v1/resumes", async (request, response, next) => {
    try {
      const userId = await authenticatedUserId(request);
      if (!userId) {
        sendError(response, 401, "UNAUTHORIZED", "Authentication is required.");
        return;
      }

      const resumes = await services.repository.listResumes(userId);
      const extractions = services.extractionRepository
        ? await services.extractionRepository.findManyOwned(
            userId,
            resumes.map((resume) => resume.id),
          )
        : [];
      const statuses = new Map(
        extractions.map((extraction) => [
          extraction.resumeId,
          extraction.status,
        ]),
      );
      response.status(200).json({
        data: resumes.map((resume) => ({
          ...resume,
          extractionStatus: statuses.get(resume.id) ?? null,
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/v1/imports", async (request, response, next) => {
    try {
      const userId = await authenticatedUserId(request);
      if (!userId) {
        sendError(response, 401, "UNAUTHORIZED", "Authentication is required.");
        return;
      }
      if (!services.objectStorage) {
        sendError(
          response,
          503,
          "STORAGE_NOT_CONFIGURED",
          "Resume storage is not configured.",
        );
        return;
      }

      const parsed = createResumeImportRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        sendError(
          response,
          400,
          "INVALID_UPLOAD",
          parsed.error.issues[0]?.message ?? "Invalid upload request.",
        );
        return;
      }
      if (expectedSourceType(parsed.data.mimeType) !== parsed.data.sourceType) {
        sendError(
          response,
          400,
          "SOURCE_TYPE_MISMATCH",
          "The selected file type does not match its source type.",
        );
        return;
      }

      const importId = createId("import");
      const resumeId = createId("resume");
      const fileId = createId("file");
      const objectKey = `users/${userId}/resumes/${resumeId}/original/${fileId}.${fileExtensions[parsed.data.mimeType]}`;
      const signedUpload = await services.objectStorage.createUploadUrl({
        mimeType: parsed.data.mimeType,
        objectKey,
        size: parsed.data.size,
      });
      const now = new Date();
      const record: ResumeImportRecord = {
        id: importId,
        userId,
        resumeId,
        fileId,
        name: resumeName(parsed.data.fileName),
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        size: parsed.data.size,
        sourceType: parsed.data.sourceType,
        objectKey,
        status: "awaiting_upload",
        failureCode: null,
        etag: null,
        createdAt: now,
        updatedAt: now,
      };
      await services.repository.create(record);

      response.status(201).json({
        data: {
          importId,
          resumeId,
          fileId,
          uploadUrl: signedUpload.uploadUrl,
          uploadMethod: "PUT",
          uploadHeaders: { "Content-Type": parsed.data.mimeType },
          expiresAt: signedUpload.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/v1/imports/:importId", async (request, response, next) => {
    try {
      const userId = await authenticatedUserId(request);
      if (!userId) {
        sendError(response, 401, "UNAUTHORIZED", "Authentication is required.");
        return;
      }
      const record = await services.repository.findOwned(
        userId,
        request.params.importId,
      );
      if (!record) {
        sendError(response, 404, "IMPORT_NOT_FOUND", "Import not found.");
        return;
      }
      if (!isSupportedMimeType(record.mimeType)) {
        sendError(
          response,
          410,
          "UNSUPPORTED_LEGACY_FORMAT",
          "This legacy image import must be replaced with a PDF or DOCX file.",
        );
        return;
      }
      response.status(200).json({ data: serializeImport(record) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/v1/imports/:importId/complete",
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
        if (!services.objectStorage) {
          sendError(
            response,
            503,
            "STORAGE_NOT_CONFIGURED",
            "Resume storage is not configured.",
          );
          return;
        }

        const existing = await services.repository.findOwned(
          userId,
          request.params.importId,
        );
        if (!existing) {
          sendError(response, 404, "IMPORT_NOT_FOUND", "Import not found.");
          return;
        }
        if (!isSupportedMimeType(existing.mimeType)) {
          sendError(
            response,
            410,
            "UNSUPPORTED_LEGACY_FORMAT",
            "This legacy image import must be replaced with a PDF or DOCX file.",
          );
          return;
        }
        if (existing.status === "uploaded") {
          await services.extractionRepository?.createQueued({
            userId,
            resumeId: existing.resumeId,
            importId: existing.id,
            objectKey: existing.objectKey,
            mimeType: existing.mimeType,
          });
          response.status(200).json({ data: serializeImport(existing) });
          return;
        }

        const record = await services.repository.claimForVerification(
          userId,
          request.params.importId,
        );
        if (!record) {
          sendError(
            response,
            409,
            "IMPORT_NOT_READY",
            "This import cannot be completed in its current state.",
          );
          return;
        }

        let inspection;
        try {
          inspection = await services.objectStorage.inspectObject(
            record.objectKey,
          );
        } catch {
          const failed = await services.repository.markFailed(
            userId,
            record.id,
            "OBJECT_VERIFICATION_FAILED",
          );
          if (!failed) {
            sendError(
              response,
              409,
              "IMPORT_STATE_CHANGED",
              "This import was cancelled while verification was running.",
            );
            return;
          }
          sendError(
            response,
            422,
            "OBJECT_VERIFICATION_FAILED",
            "The uploaded file could not be verified. Please try again.",
          );
          return;
        }

        const validObject =
          inspection.size === record.size &&
          inspection.reportedMimeType === record.mimeType &&
          inspection.detectedMimeType === record.mimeType;
        if (!validObject) {
          const failed = await services.repository.markFailed(
            userId,
            record.id,
            "FILE_VALIDATION_FAILED",
          );
          await services.objectStorage
            .deleteObject(record.objectKey)
            .catch(() => {});
          if (!failed) {
            sendError(
              response,
              409,
              "IMPORT_STATE_CHANGED",
              "This import was cancelled while verification was running.",
            );
            return;
          }
          sendError(
            response,
            422,
            "FILE_VALIDATION_FAILED",
            "The uploaded file does not match the selected type or size.",
          );
          return;
        }

        const uploaded = await services.repository.markUploaded(
          userId,
          record.id,
          inspection.etag,
        );
        if (!uploaded) {
          sendError(
            response,
            409,
            "IMPORT_STATE_CHANGED",
            "This import was cancelled while verification was running.",
          );
          return;
        }
        await services.extractionRepository?.createQueued({
          userId,
          resumeId: uploaded.resumeId,
          importId: uploaded.id,
          objectKey: uploaded.objectKey,
          mimeType: uploaded.mimeType,
        });
        response.status(202).json({ data: serializeImport(uploaded) });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/api/v1/imports/:importId",
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
        const record = await services.repository.cancel(
          userId,
          request.params.importId,
        );
        if (!record) {
          sendError(
            response,
            409,
            "IMPORT_NOT_CANCELLABLE",
            "This import cannot be cancelled.",
          );
          return;
        }
        await services.objectStorage
          ?.deleteObject(record.objectKey)
          .catch(() => {});
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
