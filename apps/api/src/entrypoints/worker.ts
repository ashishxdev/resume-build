import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createLogger } from "../shared/logging/logger.js";
import { createResumeAiParser } from "../infrastructure/ai/resume-ai-parser.js";
import { createR2ObjectStorage } from "../infrastructure/storage/r2-object-storage.js";
import { createResumeExtractionRepositoryRuntime } from "../modules/resumes/resume-extraction-repository.js";
import { createResumeExtractionService } from "../modules/resumes/resume-extraction-service.js";
import { startResumeExtractionLoop } from "../modules/resumes/resume-extraction-loop.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);

logger.info("Worker started");

const extractionRuntime = createResumeExtractionRepositoryRuntime(environment);
const stopExtractionLoop = startResumeExtractionLoop(
  createResumeExtractionService(
    extractionRuntime.repository,
    createR2ObjectStorage(environment),
    logger,
    createResumeAiParser(environment),
  ),
);

function shutdown(signal: string) {
  logger.info({ signal }, "Worker shutting down");
  stopExtractionLoop();
  void extractionRuntime.close();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
