import { z } from "zod";

export const atsAnalysisStatusSchema = z.enum([
  "not_started",
  "queued",
  "analyzing",
  "completed",
  "failed",
]);

export const atsCategorySchema = z.enum([
  "keyword_coverage",
  "skill_alignment",
  "experience_relevance",
  "section_completeness",
  "structure_readability",
  "formatting_compatibility",
]);

export const atsCategoryResultSchema = z.object({
  category: atsCategorySchema,
  label: z.string(),
  score: z.number().int().min(0).max(100),
  explanation: z.string(),
});

export const atsFindingSchema = z.object({
  id: z.string(),
  type: z.enum(["strength", "can_improve", "missing"]),
  title: z.string(),
  explanation: z.string(),
  requirementIds: z.array(z.string()),
  resumeClaimIds: z.array(z.string()),
});

export const atsAnalysisSnapshotSchema = z.object({
  tailoredVersionId: z.string(),
  overallScore: z.number().int().min(0).max(100),
  categories: z.array(atsCategoryResultSchema).length(6),
  findings: z.array(atsFindingSchema).max(100),
  analyzedAt: z.string(),
  methodologyVersion: z.string(),
});

export const atsAnalysisStateSchema = z.object({
  status: atsAnalysisStatusSchema,
  failureMessage: z.string().nullable(),
  snapshot: atsAnalysisSnapshotSchema.nullable(),
});

export type AtsAnalysisStatus = z.infer<typeof atsAnalysisStatusSchema>;
export type AtsAnalysisSnapshot = z.infer<typeof atsAnalysisSnapshotSchema>;
