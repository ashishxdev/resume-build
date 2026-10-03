import { z } from "zod";

export const resumeClaimCategorySchema = z.enum([
  "personal_info",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "achievements",
  "custom",
]);

export const resumeClaimStatusSchema = z.enum([
  "unreviewed",
  "confirmed",
  "edited",
  "rejected",
]);

export const resumeExtractionStatusSchema = z.enum([
  "queued",
  "processing",
  "review_required",
  "verified",
  "failed",
]);

export const resumeClaimSchema = z.object({
  id: z.string(),
  category: resumeClaimCategorySchema,
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(10_000),
  sourceText: z.string().max(10_000).nullable(),
  pageNumber: z.number().int().positive().nullable(),
  status: resumeClaimStatusSchema,
  userAdded: z.boolean(),
  order: z.number().int().nonnegative(),
});

export const resumeVerificationSchema = z.object({
  resumeId: z.string(),
  versionId: z.string().nullable(),
  jobId: z.string(),
  status: resumeExtractionStatusSchema,
  progress: z.number().int().min(0).max(100),
  failureMessage: z.string().nullable(),
  claims: z.array(resumeClaimSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updateResumeVerificationRequestSchema = z.object({
  claims: z.array(resumeClaimSchema).max(500),
});

export type ResumeClaim = z.infer<typeof resumeClaimSchema>;
export type ResumeClaimCategory = z.infer<typeof resumeClaimCategorySchema>;
export type ResumeClaimStatus = z.infer<typeof resumeClaimStatusSchema>;
export type ResumeExtractionStatus = z.infer<
  typeof resumeExtractionStatusSchema
>;
export type ResumeVerification = z.infer<typeof resumeVerificationSchema>;
export type UpdateResumeVerificationRequest = z.infer<
  typeof updateResumeVerificationRequestSchema
>;
