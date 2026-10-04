import type {
  AtsAnalysisSnapshot,
  JobRequirement,
  ResumeClaim,
} from "@make-my-resume/contracts";
import type { Logger } from "pino";

import { createId } from "../../shared/ids/create-id.js";
import type {
  TailoringRepository,
  TailoringSessionRecord,
} from "./tailoring-repository.js";

const methodologyVersion = "transparent-ats-v1";
const stopWords = new Set([
  "and",
  "the",
  "with",
  "for",
  "from",
  "that",
  "this",
  "your",
  "our",
  "will",
  "have",
  "has",
  "are",
  "you",
  "job",
  "role",
  "years",
  "into",
]);

function tokens(value: string) {
  const matches =
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .match(
        /c\s+plus\s+plus|c\s+sharp|c\+\+|c#|\.net|dotnet|[a-z0-9]+(?:\.[a-z0-9]+)+|[a-z0-9]+/g,
      ) ?? [];
  const normalized = new Set<string>();
  for (const match of matches) {
    const token =
      match === "csharp" || match === "c sharp"
        ? "c#"
        : match === "cplusplus" || match === "c plus plus"
          ? "c++"
          : match === "dotnet"
            ? ".net"
            : match;
    if (token.length >= 3 || ["c#", "c++", ".net"].includes(token)) {
      if (!stopWords.has(token)) normalized.add(token);
      if (token.endsWith(".net")) normalized.add(".net");
    }
  }
  return [...normalized];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function coverage(requirements: JobRequirement[], claims: ResumeClaim[]) {
  const resumeTokens = new Set(
    tokens(claims.map((claim) => `${claim.label} ${claim.value}`).join(" ")),
  );
  const required = requirements.flatMap((item) =>
    tokens(`${item.label} ${item.sourceQuote}`),
  );
  const unique = [...new Set(required)];
  if (!unique.length) return 100;
  return clamp(
    (unique.filter((token) => resumeTokens.has(token)).length / unique.length) *
      100,
  );
}

function weightedMatch(record: TailoringSessionRecord, categories?: string[]) {
  const requirements = new Map(
    record.analysis.requirements.map((item) => [item.id, item]),
  );
  const matches = record.analysis.matches.filter((match) =>
    categories
      ? categories.includes(
          requirements.get(match.requirementId)?.category ?? "",
        )
      : true,
  );
  if (!matches.length) return 100;
  const points = matches.reduce((sum, match) => {
    const requirement = requirements.get(match.requirementId);
    const weight = requirement?.priority === "required" ? 2 : 1;
    const value =
      match.status === "strong" ? 1 : match.status === "partial" ? 0.55 : 0;
    return sum + weight * value;
  }, 0);
  const total = matches.reduce(
    (sum, match) =>
      sum +
      (requirements.get(match.requirementId)?.priority === "required" ? 2 : 1),
    0,
  );
  return clamp((points / total) * 100);
}

export function analyzeAts(
  record: TailoringSessionRecord,
): AtsAnalysisSnapshot {
  if (!record.tailoredVersionId || !record.finalClaims)
    throw new Error("TAILORED_VERSION_REQUIRED");
  const claims = record.finalClaims;
  const categoriesPresent = new Set<string>(
    claims.map((claim) => claim.category),
  );
  const expected = ["experience", "education", "skills"];
  const sectionScore = clamp(
    (expected.filter((item) => categoriesPresent.has(item)).length /
      expected.length) *
      100,
  );
  const readable = claims.filter(
    (claim) => claim.value.length >= 20 && claim.value.length <= 350,
  ).length;
  const readabilityScore = claims.length
    ? clamp((readable / claims.length) * 100)
    : 0;
  const formattingScore =
    claims.length > 0 &&
    claims.every((claim) => claim.value.trim() === claim.value)
      ? 96
      : 80;
  const keywordScore = coverage(record.analysis.requirements, claims);
  const skillScore = weightedMatch(record, ["skill"]);
  const experienceScore = weightedMatch(record, [
    "experience",
    "responsibility",
  ]);
  const categories = [
    {
      category: "keyword_coverage" as const,
      label: "Keyword coverage",
      score: keywordScore,
      explanation:
        "Measures transparent term coverage between the job requirements and this tailored version.",
    },
    {
      category: "skill_alignment" as const,
      label: "Skill alignment",
      score: skillScore,
      explanation:
        "Weights required and preferred skills against the verified evidence mapped during job analysis.",
    },
    {
      category: "experience_relevance" as const,
      label: "Experience relevance",
      score: experienceScore,
      explanation:
        "Measures how strongly verified experience supports the role’s responsibilities.",
    },
    {
      category: "section_completeness" as const,
      label: "Section completeness",
      score: sectionScore,
      explanation:
        "Checks whether core resume sections are represented in the structured version.",
    },
    {
      category: "structure_readability" as const,
      label: "Structure & readability",
      score: readabilityScore,
      explanation:
        "Checks claim length and scannability without judging visual style.",
    },
    {
      category: "formatting_compatibility" as const,
      label: "Formatting compatibility",
      score: formattingScore,
      explanation:
        "Structured text is available for machine-readable export; final PDF layout will be checked at export time.",
    },
  ];
  const findings = record.analysis.matches.map((match) => {
    const requirement = record.analysis.requirements.find(
      (item) => item.id === match.requirementId,
    )!;
    const type =
      match.status === "strong"
        ? ("strength" as const)
        : match.status === "partial"
          ? ("can_improve" as const)
          : ("missing" as const);
    return {
      id: createId("ats"),
      type,
      title: requirement.label,
      explanation:
        type === "missing"
          ? "No verified evidence supports this requirement. It is reported as missing and will not be invented."
          : type === "can_improve"
            ? "Related verified evidence exists, but the requirement is only partially represented."
            : "This requirement is directly supported by verified resume evidence.",
      requirementIds: [requirement.id],
      resumeClaimIds: match.resumeClaimIds.filter((id) =>
        claims.some((claim) => claim.id === id),
      ),
    };
  });
  const overallScore = clamp(
    categories.reduce((sum, item) => sum + item.score, 0) / categories.length,
  );
  return {
    tailoredVersionId: record.tailoredVersionId,
    overallScore,
    categories,
    findings,
    analyzedAt: new Date().toISOString(),
    methodologyVersion,
  };
}

export function createAtsAnalysisService(
  repository: TailoringRepository,
  logger: Logger,
) {
  return {
    async processNext() {
      const record = await repository.claimNextAts();
      if (!record?.atsProcessingToken) return false;
      try {
        const snapshot = analyzeAts(record);
        const saved = await repository.completeAts(
          record.id,
          record.atsProcessingToken,
          snapshot,
        );
        if (!saved)
          logger.warn(
            { tailoringSessionId: record.id },
            "ATS completion lost its processing lease",
          );
      } catch {
        await repository.failAts(
          record.id,
          record.atsProcessingToken,
          "We could not complete the ATS compatibility analysis. Please try again.",
        );
      }
      return true;
    },
  };
}

export type AtsAnalysisService = ReturnType<typeof createAtsAnalysisService>;
