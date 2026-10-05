import { z } from "zod";

import { jobDescriptionAnalysisSchema } from "../job-description/analysis.js";
import { resumeClaimSchema } from "../resume/verification.js";
import { suggestionStatusSchema } from "../suggestions/status.js";
import {
  atsAnalysisSnapshotSchema,
  atsAnalysisStatusSchema,
  atsImprovementStatusSchema,
} from "../ats/analysis.js";

export const tailoringSessionStatusSchema = z.enum([
  "queued",
  "generating",
  "review",
  "completed",
  "failed",
]);

export const tailoringSuggestionSchema = z.object({
  id: z.string(),
  sourceClaimId: z.string(),
  requirementIds: z.array(z.string()).min(1).max(20),
  section: z.string().trim().min(1).max(120),
  originalText: z.string().trim().min(1).max(10_000),
  suggestedText: z.string().trim().min(1).max(10_000),
  reason: z.string().trim().min(1).max(1_000),
  status: suggestionStatusSchema,
  editedText: z.string().trim().min(1).max(10_000).nullable(),
});

export const tailoringSessionSchema = z.object({
  id: z.string(),
  jobDescriptionId: z.string(),
  resumeId: z.string(),
  resumeVersionId: z.string(),
  role: z.string().nullable(),
  company: z.string().nullable(),
  status: tailoringSessionStatusSchema,
  failureMessage: z.string().nullable(),
  suggestions: z.array(tailoringSuggestionSchema).max(100),
  evidenceClaims: z.array(resumeClaimSchema),
  analysis: jobDescriptionAnalysisSchema,
  tailoredVersionId: z.string().nullable(),
  finalClaims: z.array(resumeClaimSchema).nullable(),
  atsStatus: atsAnalysisStatusSchema,
  atsFailureMessage: z.string().nullable(),
  atsSnapshot: atsAnalysisSnapshotSchema.nullable(),
  atsImprovementStatus: atsImprovementStatusSchema,
  atsImprovementFailureMessage: z.string().nullable(),
  atsImprovementSuggestions: z.array(tailoringSuggestionSchema).max(100),
  atsImprovedVersionId: z.string().nullable(),
  atsImprovedClaims: z.array(resumeClaimSchema).nullable(),
  atsImprovedSnapshot: atsAnalysisSnapshotSchema.nullable(),
  atsImprovementActive: z.boolean(),
  revision: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updateTailoringSuggestionRequestSchema = z.object({
  revision: z.number().int().nonnegative(),
  status: z.enum(["accepted", "rejected"]),
  editedText: z.string().trim().min(1).max(10_000).nullable().optional(),
});

export const completeTailoringSessionRequestSchema = z.object({
  revision: z.number().int().nonnegative(),
});

export type TailoringSessionStatus = z.infer<
  typeof tailoringSessionStatusSchema
>;
export type TailoringSuggestion = z.infer<typeof tailoringSuggestionSchema>;
export type TailoringSession = z.infer<typeof tailoringSessionSchema>;
export type UpdateTailoringSuggestionRequest = z.infer<
  typeof updateTailoringSuggestionRequestSchema
>;
