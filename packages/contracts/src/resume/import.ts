import { z } from "zod";

export const MAX_RESUME_FILE_SIZE = 10 * 1024 * 1024;

export const resumeMimeTypeSchema = z.enum([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const resumeSourceTypeSchema = z.enum(["pdf", "docx"]);

export const resumeImportStatusSchema = z.enum([
  "awaiting_upload",
  "verifying",
  "uploaded",
  "failed",
  "cancelled",
]);

export const createResumeImportRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: resumeMimeTypeSchema,
  size: z.number().int().positive().max(MAX_RESUME_FILE_SIZE),
  sourceType: resumeSourceTypeSchema,
});

export const resumeImportSchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  fileId: z.string(),
  fileName: z.string(),
  mimeType: resumeMimeTypeSchema,
  size: z.number().int().positive(),
  sourceType: resumeSourceTypeSchema,
  status: resumeImportStatusSchema,
  failureCode: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const createResumeImportResponseSchema = z.object({
  importId: z.string(),
  resumeId: z.string(),
  fileId: z.string(),
  uploadUrl: z.url(),
  uploadMethod: z.literal("PUT"),
  uploadHeaders: z.object({ "Content-Type": resumeMimeTypeSchema }),
  expiresAt: z.string(),
});

export const resumeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  originalFileName: z.string(),
  importId: z.string(),
  importStatus: resumeImportStatusSchema,
  extractionStatus: z
    .enum(["queued", "processing", "review_required", "verified", "failed"])
    .nullable(),
  compatibilityStatus: z.enum(["supported", "unsupported_legacy_format"]),
  updatedAt: z.string(),
});

export type CreateResumeImportRequest = z.infer<
  typeof createResumeImportRequestSchema
>;
export type CreateResumeImportResponse = z.infer<
  typeof createResumeImportResponseSchema
>;
export type ResumeImport = z.infer<typeof resumeImportSchema>;
export type ResumeImportStatus = z.infer<typeof resumeImportStatusSchema>;
export type ResumeMimeType = z.infer<typeof resumeMimeTypeSchema>;
export type ResumeSourceType = z.infer<typeof resumeSourceTypeSchema>;
export type ResumeSummary = z.infer<typeof resumeSummarySchema>;
