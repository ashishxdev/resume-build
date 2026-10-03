import { createApp } from "../app/create-app.js";
import { loadEnvironment } from "../config/environment.js";
import { loadLocalEnvironmentFiles } from "../config/load-local-environment.js";
import { createAuthRuntime } from "../infrastructure/auth/auth.js";
import { createResumeAiParser } from "../infrastructure/ai/resume-ai-parser.js";
import { createR2ObjectStorage } from "../infrastructure/storage/r2-object-storage.js";
import { createResumeImportRepositoryRuntime } from "../modules/resumes/resume-import-repository.js";
import { createResumeExtractionRepositoryRuntime } from "../modules/resumes/resume-extraction-repository.js";
import { createResumeExtractionService } from "../modules/resumes/resume-extraction-service.js";
import { startResumeExtractionLoop } from "../modules/resumes/resume-extraction-loop.js";
import { createLogger } from "../shared/logging/logger.js";

loadLocalEnvironmentFiles();

const environment = loadEnvironment();
const logger = createLogger(environment);
const authRuntime = createAuthRuntime(environment);
const resumeImportRuntime = createResumeImportRepositoryRuntime(environment);
const resumeExtractionRuntime =
  createResumeExtractionRepositoryRuntime(environment);
const objectStorage = createR2ObjectStorage(environment);
const stopExtractionLoop = startResumeExtractionLoop(
  createResumeExtractionService(
    resumeExtractionRuntime.repository,
    objectStorage,
    logger,
    createResumeAiParser(environment),
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
);

const server = app.listen(environment.PORT, () => {
  logger.info({ port: environment.PORT }, "API listening");
});

server.ref();

function shutdown(signal: string) {
  logger.info({ signal }, "API shutting down");
  server.close(async (error) => {
    stopExtractionLoop();
    if (error) {
      logger.error({ error }, "API shutdown failed");
      process.exitCode = 1;
    }
    await authRuntime.close();
    await resumeImportRuntime.close();
    await resumeExtractionRuntime.close();
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
