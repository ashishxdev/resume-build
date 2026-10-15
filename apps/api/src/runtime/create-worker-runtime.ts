import type { Environment } from "../config/environment.js";
import { createJobDescriptionAnalyzer } from "../infrastructure/ai/job-description-analyzer.js";
import { createResumeAiParser } from "../infrastructure/ai/resume-ai-parser.js";
import { createTailoringGenerator } from "../infrastructure/ai/tailoring-generator.js";
import { createR2ObjectStorage } from "../infrastructure/storage/r2-object-storage.js";
import { createJobDescriptionAnalysisService } from "../modules/job-descriptions/job-description-analysis-service.js";
import { startJobDescriptionAnalysisLoop } from "../modules/job-descriptions/job-description-analysis-loop.js";
import { createJobDescriptionRepositoryRuntime } from "../modules/job-descriptions/job-description-repository.js";
import { createMemoryResumeStore } from "../modules/resumes/memory-resume-store.js";
import { startResumeExtractionLoop } from "../modules/resumes/resume-extraction-loop.js";
import { createResumeExtractionRepositoryRuntime } from "../modules/resumes/resume-extraction-repository.js";
import { createResumeExtractionService } from "../modules/resumes/resume-extraction-service.js";
import { createAtsAnalysisService } from "../modules/tailoring/ats-analysis-service.js";
import { startAtsAnalysisLoop } from "../modules/tailoring/ats-analysis-loop.js";
import { startTailoringLoop } from "../modules/tailoring/tailoring-loop.js";
import { createTailoringRepositoryRuntime } from "../modules/tailoring/tailoring-repository.js";
import { createTailoringService } from "../modules/tailoring/tailoring-service.js";
import { createLogger } from "../shared/logging/logger.js";

export function createWorkerRuntime(environment: Environment) {
  const logger = createLogger(environment);
  const memoryResumeStore =
    environment.AUTH_STORAGE === "memory"
      ? createMemoryResumeStore()
      : undefined;
  const extractionRuntime = createResumeExtractionRepositoryRuntime(
    environment,
    memoryResumeStore,
  );
  const jobDescriptionRuntime =
    createJobDescriptionRepositoryRuntime(environment);
  const tailoringRuntime = createTailoringRepositoryRuntime(
    environment,
    memoryResumeStore,
  );
  const stopLoops = [
    startResumeExtractionLoop(
      createResumeExtractionService(
        extractionRuntime.repository,
        createR2ObjectStorage(environment),
        logger,
        createResumeAiParser(environment),
      ),
    ),
    startJobDescriptionAnalysisLoop(
      createJobDescriptionAnalysisService(
        jobDescriptionRuntime.repository,
        createJobDescriptionAnalyzer(environment),
        logger,
      ),
    ),
    startTailoringLoop(
      createTailoringService(
        tailoringRuntime.repository,
        createTailoringGenerator(environment),
        logger,
      ),
    ),
    startAtsAnalysisLoop(
      createAtsAnalysisService(tailoringRuntime.repository, logger),
    ),
  ];
  let closed = false;

  logger.info("Worker started");

  return {
    async close() {
      if (closed) return;
      closed = true;
      for (const stopLoop of stopLoops) stopLoop();
      await Promise.allSettled([
        extractionRuntime.close(),
        jobDescriptionRuntime.close(),
        tailoringRuntime.close(),
      ]);
    },
  };
}
