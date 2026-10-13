import { z } from "zod";

import {
  professionalResumeDocumentSchema,
  resumePresentationSettingsSchema,
} from "./document.js";

export const resumeShareSchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  versionId: z.string(),
  token: z.string().min(32).max(128),
  enabled: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const resumeShareStatusSchema = resumeShareSchema.nullable();

export const updateResumeShareRequestSchema = z.object({
  enabled: z.boolean(),
});

export const publicResumeShareSchema = z.object({
  versionName: z.string().trim().min(1).max(120),
  document: professionalResumeDocumentSchema,
  presentation: resumePresentationSettingsSchema,
  updatedAt: z.string(),
});

export type ResumeShare = z.infer<typeof resumeShareSchema>;
export type ResumeShareStatus = z.infer<typeof resumeShareStatusSchema>;
export type UpdateResumeShareRequest = z.infer<
  typeof updateResumeShareRequestSchema
>;
export type PublicResumeShare = z.infer<typeof publicResumeShareSchema>;
