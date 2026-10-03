import { z } from "zod";

import { resumeClaimSchema } from "../resume/verification.js";

export const jobRequirementCategorySchema = z.enum([
  "skill",
  "responsibility",
  "experience",
  "qualification",
  "keyword",
]);

export const jobRequirementPrioritySchema = z.enum([
  "required",
  "preferred",
  "contextual",
]);

export const resumeMatchStatusSchema = z.enum(["strong", "partial", "missing"]);

export const jobDescriptionAnalysisStatusSchema = z.enum([
  "queued",
  "analyzing",
  "completed",
  "failed",
]);

export const jobRequirementSchema = z.object({
  id: z.string(),
  category: jobRequirementCategorySchema,
  priority: jobRequirementPrioritySchema,
  label: z.string().trim().min(1).max(240),
  sourceQuote: z.string().trim().min(1).max(2_000),
});

export const resumeRequirementMatchSchema = z.object({
  requirementId: z.string(),
  status: resumeMatchStatusSchema,
  resumeClaimIds: z.array(z.string()).max(20),
  explanation: z.string().trim().min(1).max(1_000),
});

export const jobDescriptionAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(1_000),
  requirements: z.array(jobRequirementSchema).max(100),
  matches: z.array(resumeRequirementMatchSchema).max(100),
});

export const createJobDescriptionRequestSchema = z.object({
  resumeId: z.string().trim().min(1),
  role: z.string().trim().max(160).optional(),
  company: z.string().trim().max(160).optional(),
  rawText: z.string().trim().min(100).max(50_000),
});

export const jobDescriptionSchema = z.object({
  id: z.string(),
  resumeId: z.string(),
  resumeVersionId: z.string(),
  role: z.string().nullable(),
  company: z.string().nullable(),
  rawText: z.string(),
  status: jobDescriptionAnalysisStatusSchema,
  failureMessage: z.string().nullable(),
  analysis: jobDescriptionAnalysisSchema.nullable(),
  evidenceClaims: z.array(resumeClaimSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type JobRequirementCategory = z.infer<
  typeof jobRequirementCategorySchema
>;
export type JobRequirementPriority = z.infer<
  typeof jobRequirementPrioritySchema
>;
export type ResumeMatchStatus = z.infer<typeof resumeMatchStatusSchema>;
export type JobDescriptionAnalysisStatus = z.infer<
  typeof jobDescriptionAnalysisStatusSchema
>;
export type JobRequirement = z.infer<typeof jobRequirementSchema>;
export type ResumeRequirementMatch = z.infer<
  typeof resumeRequirementMatchSchema
>;
export type JobDescriptionAnalysis = z.infer<
  typeof jobDescriptionAnalysisSchema
>;
export type JobDescription = z.infer<typeof jobDescriptionSchema>;
export type CreateJobDescriptionRequest = z.infer<
  typeof createJobDescriptionRequestSchema
>;
