import type {
  ResumeClaim,
  ResumeClaimCategory,
} from "@make-my-resume/contracts";

import { createId } from "../../shared/ids/create-id.js";
import type { ExtractedPage } from "./document-text-extractor.js";

const headings: Array<[RegExp, ResumeClaimCategory]> = [
  [/^(summary|professional summary|profile|objective|about)$/i, "summary"],
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

interface ParsedLine {
  category: ResumeClaimCategory;
  value: string;
  sourceText: string;
  pageNumber: number;
}

const dateRangePattern =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|20\d{2})\b[\s\S]{0,35}(?:present|current|20\d{2})\b/i;

function startsRecord(line: ParsedLine) {
  if (line.category === "projects") {
    return (
      /\|\s*(?:live|github)\b/i.test(line.value) ||
      dateRangePattern.test(line.value)
    );
  }
  return dateRangePattern.test(line.value);
}

function groupRecords(lines: ParsedLine[]) {
  const groups: ParsedLine[][] = [];
  let current: ParsedLine[] = [];
  for (const line of lines) {
    if (startsRecord(line) && current.length > 0) {
      groups.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

function createClaim(lines: ParsedLine[], order: number): ResumeClaim | null {
  const first = lines[0];
  if (!first) return null;
  return {
    id: createId("claim"),
    category: first.category,
    label: categoryLabel(first.category),
    value: lines.map((line) => line.value).join("\n"),
    sourceText: lines.map((line) => line.sourceText).join("\n"),
    pageNumber: first.pageNumber,
    status: "unreviewed",
    userAdded: false,
    order,
  };
}

function groupedPageClaims(lines: ParsedLine[], startingOrder: number) {
  const claims: ResumeClaim[] = [];
  const categoryOrder = Array.from(new Set(lines.map((line) => line.category)));
  for (const category of categoryOrder) {
    const categoryLines = lines.filter((line) => line.category === category);
    const groups = ["experience", "education", "projects"].includes(category)
      ? groupRecords(categoryLines)
      : ["certifications", "achievements"].includes(category)
        ? categoryLines.map((line) => [line])
        : [categoryLines];
    for (const group of groups) {
      const claim = createClaim(group, startingOrder + claims.length);
      if (claim) claims.push(claim);
    }
  }
  return claims;
}

export function parseResumeClaims(pages: ExtractedPage[]): ResumeClaim[] {
  const claims: ResumeClaim[] = [];
  let category: ResumeClaimCategory = "personal_info";

  for (const page of pages) {
    const pageLines: ParsedLine[] = [];
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
      pageLines.push({
        category,
        value,
        sourceText: rawLine.trim(),
        pageNumber: page.pageNumber,
      });
    }
    claims.push(...groupedPageClaims(pageLines, claims.length));
  }

  return claims.slice(0, 100);
}
