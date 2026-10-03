import type {
  ResumeClaim,
  ResumeClaimCategory,
} from "@make-my-resume/contracts";

import { createId } from "../../shared/ids/create-id.js";
import type { ExtractedPage } from "./document-text-extractor.js";

const headings: Array<[RegExp, ResumeClaimCategory]> = [
  [/^(summary|profile|objective|about)$/i, "summary"],
  [
    /^(experience|employment|work experience|professional experience)$/i,
    "experience",
  ],
  [/^(education|academic background)$/i, "education"],
  [/^(skills|technical skills|core competencies|expertise)$/i, "skills"],
  [/^(projects|selected projects)$/i, "projects"],
  [/^(certifications?|licenses?)$/i, "certifications"],
  [/^(achievements?|awards?|honors?)$/i, "achievements"],
];

function normalizedLine(line: string) {
  return line
    .replace(/^[-•●▪◦]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryLabel(category: ResumeClaimCategory) {
  return category
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

export function parseResumeClaims(pages: ExtractedPage[]): ResumeClaim[] {
  const claims: ResumeClaim[] = [];
  let category: ResumeClaimCategory = "personal_info";

  for (const page of pages) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      const value = normalizedLine(rawLine);
      if (!value) continue;
      const heading = headings.find(([pattern]) =>
        pattern.test(value.replace(/:$/, "")),
      );
      if (heading) {
        category = heading[1];
        continue;
      }
      if (value.length < 2) continue;
      claims.push({
        id: createId("claim"),
        category,
        label: categoryLabel(category),
        value,
        sourceText: rawLine.trim(),
        pageNumber: page.pageNumber,
        status: "unreviewed",
        userAdded: false,
        order: claims.length,
      });
      if (category === "personal_info" && claims.length >= 4)
        category = "summary";
    }
  }

  return claims.slice(0, 500);
}
