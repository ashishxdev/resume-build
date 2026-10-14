import { createApp } from "../app/create-app.js";
import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createAuthRuntime } from "../infrastructure/auth/auth.js";
import { createResumeAiParser } from "../infrastructure/ai/resume-ai-parser.js";
import { createJobDescriptionAnalyzer } from "../infrastructure/ai/job-description-analyzer.js";
import { createR2ObjectStorage } from "../infrastructure/storage/r2-object-storage.js";
import { createResumeImportRepositoryRuntime } from "../modules/resumes/resume-import-repository.js";
import { createResumeExtractionRepositoryRuntime } from "../modules/resumes/resume-extraction-repository.js";
import { createResumeVersionRepositoryRuntime } from "../modules/resumes/resume-version-repository.js";
import { createResumeShareRepositoryRuntime } from "../modules/resumes/resume-share-repository.js";
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
import { createAtsAnalysisService } from "../modules/tailoring/ats-analysis-service.js";
import { startAtsAnalysisLoop } from "../modules/tailoring/ats-analysis-loop.js";
import { createMemoryResumeStore } from "../modules/resumes/memory-resume-store.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);
const authRuntime = createAuthRuntime(environment);
const memoryResumeStore =
  environment.AUTH_STORAGE === "memory" ? createMemoryResumeStore() : undefined;
const resumeImportRuntime = createResumeImportRepositoryRuntime(
  environment,
  memoryResumeStore,
);
const resumeExtractionRuntime = createResumeExtractionRepositoryRuntime(
  environment,
  memoryResumeStore,
);
const jobDescriptionRuntime =
  createJobDescriptionRepositoryRuntime(environment);
const jobAnalysisRateLimitRuntime =
  createJobAnalysisRateLimiterRuntime(environment);
const tailoringRuntime = createTailoringRepositoryRuntime(
  environment,
  memoryResumeStore,
);
const resumeVersionRuntime = createResumeVersionRepositoryRuntime(
  environment,
  tailoringRuntime.repository,
  memoryResumeStore,
);
const resumeShareRuntime = createResumeShareRepositoryRuntime(environment);
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
const stopAtsAnalysisLoop = startAtsAnalysisLoop(
  createAtsAnalysisService(tailoringRuntime.repository, logger),
);
const app = createApp(
  environment,
  authRuntime.auth,
  {
    repository: resumeImportRuntime.repository,
    extractionRepository: resumeExtractionRuntime.repository,
    jobDescriptionRepository: jobDescriptionRuntime.repository,
    tailoringRepository: tailoringRuntime.repository,
    shareRepository: resumeShareRuntime.repository,
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
    resumeImportRepository: resumeImportRuntime.repository,
    resumeVersionRepository: resumeVersionRuntime.repository,
    objectStorage,
  },
  {
    repository: resumeVersionRuntime.repository,
    resumeImportRepository: resumeImportRuntime.repository,
    objectStorage,
    shareRepository: resumeShareRuntime.repository,
  },
  {
    repository: resumeShareRuntime.repository,
    resumeVersionRepository: resumeVersionRuntime.repository,
    resumeImportRepository: resumeImportRuntime.repository,
    objectStorage,
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
    stopAtsAnalysisLoop();
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
    await resumeVersionRuntime.close();
    await resumeShareRuntime.close();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
