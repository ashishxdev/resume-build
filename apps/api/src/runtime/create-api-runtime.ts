import type { Express } from "express";

import { createApp } from "../app/create-app.js";
import type { Environment } from "../config/environment.js";
import { createAuthRuntime } from "../infrastructure/auth/auth.js";
import { createR2ObjectStorage } from "../infrastructure/storage/r2-object-storage.js";
import { createJobAnalysisRateLimiterRuntime } from "../modules/job-descriptions/job-analysis-rate-limiter.js";
import { createJobDescriptionRepositoryRuntime } from "../modules/job-descriptions/job-description-repository.js";
import { createMemoryResumeStore } from "../modules/resumes/memory-resume-store.js";
import { createResumeExtractionRepositoryRuntime } from "../modules/resumes/resume-extraction-repository.js";
import { createResumeImportRepositoryRuntime } from "../modules/resumes/resume-import-repository.js";
import { createResumeShareRepositoryRuntime } from "../modules/resumes/resume-share-repository.js";
import { createResumeVersionRepositoryRuntime } from "../modules/resumes/resume-version-repository.js";
import { createTailoringRepositoryRuntime } from "../modules/tailoring/tailoring-repository.js";

export function createApiRuntime(
  environment: Environment,
  options: { app?: Express; trustVercelProxyHeaders?: boolean } = {},
) {
  const authRuntime = createAuthRuntime(environment);
  const memoryResumeStore =
    environment.AUTH_STORAGE === "memory"
      ? createMemoryResumeStore()
      : undefined;
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
    options,
  );

  return {
    app,
    async close() {
      await Promise.allSettled([
        authRuntime.close(),
        resumeImportRuntime.close(),
        resumeExtractionRuntime.close(),
        jobDescriptionRuntime.close(),
        jobAnalysisRateLimitRuntime.close(),
        tailoringRuntime.close(),
        resumeVersionRuntime.close(),
        resumeShareRuntime.close(),
      ]);
    },
  };
}
