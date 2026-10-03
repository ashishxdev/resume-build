import type { ResumeObjectStorage } from "../../infrastructure/storage/r2-object-storage.js";
import type { Logger } from "pino";

import { extractDocumentText } from "./document-text-extractor.js";
import type { ResumeAiParser } from "./resume-ai-parser.js";
import type { ResumeExtractionRepository } from "./resume-extraction-repository.js";
import { parseResumeClaims } from "./structured-resume-parser.js";

export async function parseExtractedResume(
  pages: Awaited<ReturnType<typeof extractDocumentText>>,
  aiParser?: ResumeAiParser | null,
) {
  if (aiParser) {
    try {
      const result = await aiParser.parse(pages);
      return { ...result, parsingMode: "ai" as const };
    } catch {
      return {
        claims: parseResumeClaims(pages),
        parsingMode: "deterministic_fallback" as const,
      };
    }
  }
  return {
    claims: parseResumeClaims(pages),
    parsingMode: "deterministic" as const,
  };
}

export function createResumeExtractionService(
  repository: ResumeExtractionRepository,
  objectStorage: ResumeObjectStorage | null,
  logger?: Logger,
  aiParser?: ResumeAiParser | null,
) {
  async function processNext() {
    if (!objectStorage) return false;
    const job = await repository.claimNext();
    if (!job) return false;
    if (!job.processingToken) {
      logger?.error({ jobId: job.id }, "Claimed extraction job has no lease");
      return true;
    }

    try {
      const bytes = await objectStorage.readObject(job.objectKey);
      const pages = await extractDocumentText(bytes, job.mimeType);
      const parsing = await parseExtractedResume(pages, aiParser);
      const { claims } = parsing;
      if (parsing.parsingMode === "ai") {
        logger?.info(
          {
            jobId: job.id,
            parsingMode: parsing.parsingMode,
            provider: parsing.provider,
            model: parsing.model,
            promptVersion: parsing.promptVersion,
            claimCount: claims.length,
          },
          "Resume parsed with grounded AI extraction",
        );
      } else if (parsing.parsingMode === "deterministic_fallback") {
        logger?.warn(
          { jobId: job.id, parsingMode: parsing.parsingMode },
          "AI resume parsing was unavailable or ungrounded",
        );
      }
      if (claims.length === 0) {
        throw new Error("No readable text was found in this document.");
      }
      await repository.complete(job.id, job.processingToken, claims);
    } catch (error) {
      const message =
        error instanceof Error &&
        error.message === "No readable text was found in this document."
          ? error.message
          : "The document could not be extracted. Try a text-based PDF or DOCX file.";
      logger?.warn({ error, jobId: job.id }, "Resume extraction failed");
      await repository.fail(job.id, job.processingToken, message);
    }
    return true;
  }

  return { processNext };
}

export type ResumeExtractionService = ReturnType<
  typeof createResumeExtractionService
>;
