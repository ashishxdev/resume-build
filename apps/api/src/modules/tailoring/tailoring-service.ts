import type { Logger } from "pino";

import type { TailoringGenerator } from "./tailoring-generator.js";
import type { TailoringRepository } from "./tailoring-repository.js";

const genericFailure =
  "We could not generate suggestions. Your analysis is saved, so you can try again.";
const busyFailure =
  "Gemini is temporarily busy. Your analysis is saved—try again in a moment.";

function describeFailure(status: number | null, message: string) {
  if (status === 401 || status === 403)
    return {
      code: "AI_AUTHENTICATION_FAILED",
      message:
        "The AI provider rejected the server credentials. Check the Gemini API key and permissions in the backend environment, then retry.",
    };
  if (status === 404)
    return {
      code: "AI_MODEL_UNAVAILABLE",
      message:
        "The configured AI model is unavailable. Check AI_MODEL in the backend environment, then retry.",
    };
  if (
    [429, 503, 504].includes(status ?? 0) ||
    /timeout|high demand|temporarily unavailable/i.test(message)
  )
    return { code: "AI_PROVIDER_BUSY", message: busyFailure };
  if (/AI_UNGROUNDED|AI_EMPTY|AI_INVALID|JSON|schema|Zod/i.test(message))
    return {
      code: "AI_OUTPUT_REJECTED",
      message:
        "The AI response did not contain usable evidence-backed edits. Your resume and analysis are saved. Try generating suggestions again.",
    };
  return { code: "AI_GENERATION_FAILED", message: genericFailure };
}

export function createTailoringService(
  repository: TailoringRepository,
  generator: TailoringGenerator | null,
  logger: Logger,
) {
  async function processImprovement() {
    const record = await repository.claimNextAtsImprovement();
    if (!record?.atsImprovementProcessingToken) return false;
    if (!generator || !record.atsSnapshot || !record.finalClaims) {
      await repository.failAtsImprovement(
        record.id,
        record.atsImprovementProcessingToken,
        generator
          ? "The saved ATS analysis is unavailable. Run it again before improving this version."
          : "AI tailoring is not configured. Add the Gemini provider settings and try again.",
      );
      return true;
    }
    const eligibleFindings = record.atsSnapshot.findings.filter(
      (finding) =>
        finding.type === "can_improve" && finding.resumeClaimIds.length > 0,
    );
    const requirementIds = new Set(
      eligibleFindings.flatMap((finding) => finding.requirementIds),
    );
    const claimIds = new Set(
      eligibleFindings.flatMap((finding) => finding.resumeClaimIds),
    );
    try {
      const output = await generator.generate({
        rawJobDescription: record.rawJobDescription,
        analysis: {
          ...record.analysis,
          requirements: record.analysis.requirements.filter((requirement) =>
            requirementIds.has(requirement.id),
          ),
          matches: record.analysis.matches.filter(
            (match) =>
              requirementIds.has(match.requirementId) &&
              match.status !== "missing",
          ),
        },
        evidenceClaims: record.finalClaims.filter((claim) =>
          claimIds.has(claim.id),
        ),
      });
      const updated = await repository.generatedAtsImprovement(
        record.id,
        record.atsImprovementProcessingToken,
        output.suggestions,
      );
      if (!updated)
        logger.warn(
          { tailoringSessionId: record.id },
          "ATS improvement completion lost its processing lease",
        );
    } catch (error) {
      const status =
        typeof error === "object" && error !== null && "status" in error
          ? Number(error.status)
          : null;
      const message = error instanceof Error ? error.message : "";
      const unavailable =
        [429, 503, 504].includes(status ?? 0) ||
        /timeout|high demand|temporarily unavailable/i.test(message);
      await repository.failAtsImprovement(
        record.id,
        record.atsImprovementProcessingToken,
        unavailable ? busyFailure : genericFailure,
      );
      logger.warn(
        { tailoringSessionId: record.id, providerStatus: status },
        "ATS improvement provider request failed",
      );
    }
    return true;
  }

  return {
    async processNext() {
      const record = await repository.claimNext();
      if (!record?.processingToken) return processImprovement();
      if (!generator) {
        await repository.fail(
          record.id,
          record.processingToken,
          "AI tailoring is not configured. Add the Gemini provider settings and try again.",
        );
        return true;
      }
      try {
        const output = await generator.generate({
          rawJobDescription: record.rawJobDescription,
          analysis: record.analysis,
          evidenceClaims: record.evidenceClaims,
        });
        const updated = await repository.generated(
          record.id,
          record.processingToken,
          output,
        );
        if (!updated)
          logger.warn(
            { tailoringSessionId: record.id },
            "Tailoring completion lost its processing lease",
          );
      } catch (error) {
        const status =
          typeof error === "object" && error !== null && "status" in error
            ? Number(error.status)
            : null;
        const message = error instanceof Error ? error.message : "";
        const failure = describeFailure(status, message);
        await repository.fail(
          record.id,
          record.processingToken,
          failure.message,
        );
        logger.warn(
          {
            tailoringSessionId: record.id,
            providerStatus: status,
            failureCode: failure.code,
          },
          "Tailoring provider request failed",
        );
      }
      return true;
    },
  };
}

export type TailoringService = ReturnType<typeof createTailoringService>;
