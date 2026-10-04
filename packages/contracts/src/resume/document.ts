import { z } from "zod";

export const resumeDocumentSectionKindSchema = z.enum([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "achievements",
  "custom",
]);

export const resumeDocumentItemSchema = z.object({
  id: z.string(),
  sourceClaimId: z.string(),
  heading: z.string().nullable(),
  body: z.string().trim().min(1).max(10_000),
  tailored: z.boolean(),
});

export const resumeDocumentSectionSchema = z.object({
  kind: resumeDocumentSectionKindSchema,
  title: z.string().trim().min(1).max(120),
  items: z.array(resumeDocumentItemSchema).min(1).max(500),
});

export const professionalResumeDocumentSchema = z.object({
  name: z.string().trim().min(1).max(160),
  headline: z.string().trim().min(1).max(240).nullable(),
  contact: z.array(z.string().trim().min(1).max(240)).max(12),
  sections: z.array(resumeDocumentSectionSchema).max(20),
});

export const resumeTemplateDensitySchema = z.enum(["comfortable", "compact"]);

export const resumeExportFormatSchema = z.enum(["pdf", "docx"]);

export const resumeExportOptionsSchema = z.object({
  format: resumeExportFormatSchema,
  density: resumeTemplateDensitySchema.default("comfortable"),
});

export type ProfessionalResumeDocument = z.infer<
  typeof professionalResumeDocumentSchema
>;
export type ResumeDocumentSection = z.infer<typeof resumeDocumentSectionSchema>;
export type ResumeDocumentItem = z.infer<typeof resumeDocumentItemSchema>;
export type ResumeTemplateDensity = z.infer<typeof resumeTemplateDensitySchema>;
export type ResumeExportFormat = z.infer<typeof resumeExportFormatSchema>;
