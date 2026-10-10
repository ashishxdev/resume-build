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

export const resumeTemplateIdSchema = z.enum([
  "professional",
  "modern",
  "compact",
]);

export const resumeFontFamilySchema = z.enum(["hybrid", "serif", "sans"]);

export const resumeAccentColorSchema = z.enum([
  "plum",
  "navy",
  "forest",
  "charcoal",
]);

export const resumePresentationSettingsSchema = z
  .object({
    template: resumeTemplateIdSchema,
    fontFamily: resumeFontFamilySchema,
    accentColor: resumeAccentColorSchema,
    density: resumeTemplateDensitySchema,
    sectionOrder: z
      .array(resumeDocumentSectionKindSchema)
      .max(resumeDocumentSectionKindSchema.options.length),
    hiddenSections: z
      .array(resumeDocumentSectionKindSchema)
      .max(resumeDocumentSectionKindSchema.options.length - 1),
  })
  .superRefine((value, context) => {
    if (new Set(value.sectionOrder).size !== value.sectionOrder.length) {
      context.addIssue({
        code: "custom",
        message: "Section order cannot contain duplicates.",
        path: ["sectionOrder"],
      });
    }
    if (new Set(value.hiddenSections).size !== value.hiddenSections.length) {
      context.addIssue({
        code: "custom",
        message: "Hidden sections cannot contain duplicates.",
        path: ["hiddenSections"],
      });
    }
  });

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
export type ResumeTemplateId = z.infer<typeof resumeTemplateIdSchema>;
export type ResumeFontFamily = z.infer<typeof resumeFontFamilySchema>;
export type ResumeAccentColor = z.infer<typeof resumeAccentColorSchema>;
export type ResumePresentationSettings = z.infer<
  typeof resumePresentationSettingsSchema
>;
export type ResumeExportFormat = z.infer<typeof resumeExportFormatSchema>;

export const DEFAULT_RESUME_PRESENTATION: ResumePresentationSettings = {
  template: "professional",
  fontFamily: "hybrid",
  accentColor: "plum",
  density: "comfortable",
  sectionOrder: [...resumeDocumentSectionKindSchema.options],
  hiddenSections: [],
};

export const RESUME_ACCENT_COLORS: Record<ResumeAccentColor, string> = {
  plum: "#38204E",
  navy: "#24446A",
  forest: "#28624C",
  charcoal: "#34323A",
};
