import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createLogger } from "../shared/logging/logger.js";
import { createResumeAiParser } from "../infrastructure/ai/resume-ai-parser.js";
import { createR2ObjectStorage } from "../infrastructure/storage/r2-object-storage.js";
import { createResumeExtractionRepositoryRuntime } from "../modules/resumes/resume-extraction-repository.js";
import { createResumeExtractionService } from "../modules/resumes/resume-extraction-service.js";
import { startResumeExtractionLoop } from "../modules/resumes/resume-extraction-loop.js";
import { createJobDescriptionAnalyzer } from "../infrastructure/ai/job-description-analyzer.js";
import { createJobDescriptionRepositoryRuntime } from "../modules/job-descriptions/job-description-repository.js";
import { createJobDescriptionAnalysisService } from "../modules/job-descriptions/job-description-analysis-service.js";
import { startJobDescriptionAnalysisLoop } from "../modules/job-descriptions/job-description-analysis-loop.js";
import { createTailoringGenerator } from "../infrastructure/ai/tailoring-generator.js";
import { startTailoringLoop } from "../modules/tailoring/tailoring-loop.js";
import { createTailoringRepositoryRuntime } from "../modules/tailoring/tailoring-repository.js";
import { createTailoringService } from "../modules/tailoring/tailoring-service.js";
import { createAtsAnalysisService } from "../modules/tailoring/ats-analysis-service.js";
import { startAtsAnalysisLoop } from "../modules/tailoring/ats-analysis-loop.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);

logger.info("Worker started");

const extractionRuntime = createResumeExtractionRepositoryRuntime(environment);
const jobDescriptionRuntime =
  createJobDescriptionRepositoryRuntime(environment);
const tailoringRuntime = createTailoringRepositoryRuntime(environment);
const stopExtractionLoop = startResumeExtractionLoop(
  createResumeExtractionService(
    extractionRuntime.repository,
    createR2ObjectStorage(environment),
    logger,
    createResumeAiParser(environment),
  ),
);
const stopJobAnalysisLoop = startJobDescriptionAnalysisLoop(
  createJobDescriptionAnalysisService(
    jobDescriptionRuntime.repository,
    createJobDescriptionAnalyzer(environment),
    logger,
  ),
);
const stopTailoringLoop = startTailoringLoop(
  createTailoringService(
    tailoringRuntime.repository,
    createTailoringGenerator(environment),
    logger,
  ),
);
const stopAtsAnalysisLoop = startAtsAnalysisLoop(
  createAtsAnalysisService(tailoringRuntime.repository, logger),
);

function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  stopExtractionLoop();
  stopJobAnalysisLoop();
  stopTailoringLoop();
  stopAtsAnalysisLoop();
  void extractionRuntime.close();
  void jobDescriptionRuntime.close();
  void tailoringRuntime.close();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
