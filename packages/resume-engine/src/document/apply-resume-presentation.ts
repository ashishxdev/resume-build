import {
  DEFAULT_RESUME_PRESENTATION,
  type ProfessionalResumeDocument,
  type ResumePresentationSettings,
} from "@make-my-resume/contracts";

const legacyDefaultSectionOrder = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "achievements",
  "custom",
] as const;

function usesLegacyDefaultOrder(order: readonly string[] | null | undefined) {
  return (
    order?.length === legacyDefaultSectionOrder.length &&
    order.every((kind, index) => kind === legacyDefaultSectionOrder[index])
  );
}

export function normalizeResumePresentation(
  presentation?: Partial<ResumePresentationSettings> | null,
): ResumePresentationSettings {
  const suppliedOrder = presentation?.sectionOrder;
  return {
    ...DEFAULT_RESUME_PRESENTATION,
    ...presentation,
    sectionOrder:
      !suppliedOrder || usesLegacyDefaultOrder(suppliedOrder)
        ? DEFAULT_RESUME_PRESENTATION.sectionOrder
        : suppliedOrder,
    hiddenSections:
      presentation?.hiddenSections ??
      DEFAULT_RESUME_PRESENTATION.hiddenSections,
  };
}

export function applyResumePresentation(
  document: ProfessionalResumeDocument,
  input?: Partial<ResumePresentationSettings> | null,
): ProfessionalResumeDocument {
  const presentation = normalizeResumePresentation(input);
  const hidden = new Set(presentation.hiddenSections);
  const priority = new Map(
    presentation.sectionOrder.map((kind, index) => [kind, index]),
  );
  return {
    ...document,
    sections: document.sections
      .filter((section) => !hidden.has(section.kind))
      .sort(
        (left, right) =>
          (priority.get(left.kind) ?? Number.MAX_SAFE_INTEGER) -
          (priority.get(right.kind) ?? Number.MAX_SAFE_INTEGER),
      ),
  };
}
