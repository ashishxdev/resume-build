import { createApp } from "../app/create-app.js";
import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createAuthRuntime } from "../infrastructure/auth/auth.js";
import { createResumeAiParser } from "../infrastructure/ai/resume-ai-parser.js";
import { createJobDescriptionAnalyzer } from "../infrastructure/ai/job-description-analyzer.js";
import { createR2ObjectStorage } from "../infrastructure/storage/r2-object-storage.js";
import { createResumeImportRepositoryRuntime } from "../modules/resumes/resume-import-repository.js";
import { createResumeExtractionRepositoryRuntime } from "../modules/resumes/resume-extraction-repository.js";
import { createResumeExtractionService } from "../modules/resumes/resume-extraction-service.js";
import { createJobDescriptionRepositoryRuntime } from "../modules/job-descriptions/job-description-repository.js";
import { createJobAnalysisRateLimiterRuntime } from "../modules/job-descriptions/job-analysis-rate-limiter.js";
import { createJobDescriptionAnalysisService } from "../modules/job-descriptions/job-description-analysis-service.js";
import { startJobDescriptionAnalysisLoop } from "../modules/job-descriptions/job-description-analysis-loop.js";
import { startResumeExtractionLoop } from "../modules/resumes/resume-extraction-loop.js";
import { createLogger } from "../shared/logging/logger.js";
import { createTailoringGenerator } from "../infrastructure/ai/tailoring-generator.js";
import { startTailoringLoop } from "../modules/tailoring/tailoring-loop.js";
import { createTailoringRepositoryRuntime } from "../modules/tailoring/tailoring-repository.js";
import { createTailoringService } from "../modules/tailoring/tailoring-service.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);
const authRuntime = createAuthRuntime(environment);
const resumeImportRuntime = createResumeImportRepositoryRuntime(environment);
const resumeExtractionRuntime =
  createResumeExtractionRepositoryRuntime(environment);
const jobDescriptionRuntime =
  createJobDescriptionRepositoryRuntime(environment);
const jobAnalysisRateLimitRuntime =
  createJobAnalysisRateLimiterRuntime(environment);
const tailoringRuntime = createTailoringRepositoryRuntime(environment);
const objectStorage = createR2ObjectStorage(environment);
const stopExtractionLoop = startResumeExtractionLoop(
  createResumeExtractionService(
    resumeExtractionRuntime.repository,
    objectStorage,
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
const app = createApp(
  environment,
  authRuntime.auth,
  authRuntime.googleEnabled,
  {
    repository: resumeImportRuntime.repository,
    extractionRepository: resumeExtractionRuntime.repository,
    objectStorage,
  },
  {
    repository: jobDescriptionRuntime.repository,
    extractionRepository: resumeExtractionRuntime.repository,
    rateLimiter: jobAnalysisRateLimitRuntime.limiter,
  },
  {
    repository: tailoringRuntime.repository,
    jobDescriptionRepository: jobDescriptionRuntime.repository,
    rateLimiter: jobAnalysisRateLimitRuntime.limiter,
  },
);

const server = app.listen(environment.PORT, () => {
  logger.info({ port: environment.PORT }, "API listening");
});

server.ref();

function shutdown(signal: string) {
  logger.info({ signal }, "API shutting down");
  server.close(async (error) => {
    stopExtractionLoop();
    stopJobAnalysisLoop();
    stopTailoringLoop();
    if (error) {
      logger.error({ error }, "API shutdown failed");
      process.exitCode = 1;
    }
    await authRuntime.close();
    await resumeImportRuntime.close();
    await resumeExtractionRuntime.close();
    await jobDescriptionRuntime.close();
    await jobAnalysisRateLimitRuntime.close();
    await tailoringRuntime.close();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
