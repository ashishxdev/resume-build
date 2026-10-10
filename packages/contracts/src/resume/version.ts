import { z } from "zod";

import { resumeClaimSchema } from "./verification.js";

export const resumeVersionTypeSchema = z.enum([
  "base",
  "tailored",
  "ats_improved",
  "restored",
]);

export const resumeVersionSummarySchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  name: z.string().trim().min(1).max(120),
  type: resumeVersionTypeSchema,
  versionNumber: z.number().int().positive(),
  sourceVersionId: z.string().nullable(),
  jobDescriptionId: z.string().nullable(),
  tailoringSessionId: z.string().nullable(),
  company: z.string().nullable(),
  role: z.string().nullable(),
  isActive: z.boolean(),
  canDelete: z.boolean(),
  deleteScope: z.enum(["version", "tailoring_session"]).nullable(),
  deleteBlockedReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const resumeVersionSchema = resumeVersionSummarySchema.extend({
  claims: z.array(resumeClaimSchema),
});

export const resumeVersionListSchema = z.object({
  resumeId: z.string(),
  resumeName: z.string(),
  activeVersionId: z.string().nullable(),
  versions: z.array(resumeVersionSummarySchema),
});

export const renameResumeVersionRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export type ResumeVersionType = z.infer<typeof resumeVersionTypeSchema>;
export type ResumeVersionSummary = z.infer<typeof resumeVersionSummarySchema>;
export type ResumeVersion = z.infer<typeof resumeVersionSchema>;
export type ResumeVersionList = z.infer<typeof resumeVersionListSchema>;
export type RenameResumeVersionRequest = z.infer<
  typeof renameResumeVersionRequestSchema
>;
