import type { Logger } from "pino";

import type { JobDescriptionAnalyzer } from "./job-description-analyzer.js";
import type { JobDescriptionRepository } from "./job-description-repository.js";

const unavailableMessage =
  "AI analysis is not configured. Add the Gemini provider settings and try again.";
const genericFailureMessage =
  "We could not analyze this job description. Your text is saved, so you can try again.";
const providerBusyMessage =
  "Gemini is temporarily busy. Your text is saved—try again in a moment.";

function failureDetails(error: unknown) {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number(error.status)
      : null;
  const message = error instanceof Error ? error.message : "";
  const temporarilyUnavailable =
    status === 429 ||
    status === 503 ||
    status === 504 ||
    /timeout|high demand|temporarily unavailable/i.test(message);
  return {
    status,
    userMessage: temporarilyUnavailable
      ? providerBusyMessage
      : genericFailureMessage,
  };
}

export function createJobDescriptionAnalysisService(
  repository: JobDescriptionRepository,
  analyzer: JobDescriptionAnalyzer | null,
  logger: Logger,
) {
  async function processNext() {
    const record = await repository.claimNext();
    if (!record?.processingToken) return false;

    if (!analyzer) {
      await repository.fail(
        record.id,
        record.processingToken,
        unavailableMessage,
      );
      return true;
    }

    try {
      const result = await analyzer.analyze({
        rawText: record.rawText,
        resumeClaims: record.evidenceClaims,
      });
      const completed = await repository.complete(
        record.id,
        record.processingToken,
        result,
      );
      if (!completed) {
        logger.warn(
          { jobDescriptionId: record.id },
          "Job analysis completion lost its processing lease",
        );
      }
    } catch (error) {
      const failure = failureDetails(error);
      await repository.fail(
        record.id,
        record.processingToken,
        failure.userMessage,
      );
      logger.warn(
        { jobDescriptionId: record.id, providerStatus: failure.status },
        "Job analysis provider request failed",
      );
    }
    return true;
  }

  return { processNext };
}

export type JobDescriptionAnalysisService = ReturnType<
  typeof createJobDescriptionAnalysisService
>;
