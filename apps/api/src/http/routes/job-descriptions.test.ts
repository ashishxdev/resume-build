import type { ResumeClaim } from "@make-my-resume/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app/create-app.js";
import { createAuthRuntime } from "../../infrastructure/auth/auth.js";
import type { JobDescriptionAnalyzer } from "../../modules/job-descriptions/job-description-analyzer.js";
import { createJobDescriptionAnalysisService } from "../../modules/job-descriptions/job-description-analysis-service.js";
import { createMemoryJobAnalysisRateLimiter } from "../../modules/job-descriptions/job-analysis-rate-limiter.js";
import { createMemoryJobDescriptionRepository } from "../../modules/job-descriptions/job-description-repository.js";
import { createMemoryResumeExtractionRepository } from "../../modules/resumes/resume-extraction-repository.js";
import { createLogger } from "../../shared/logging/logger.js";

const environment = {
  NODE_ENV: "test",
  PORT: 4000,
  LOG_LEVEL: "silent",
  WEB_ORIGIN: "http://localhost:3000",
  AUTH_STORAGE: "memory",
  MONGODB_URI: undefined,
  MONGODB_DATABASE: "make_my_resume_test",
  BETTER_AUTH_SECRET: "test-secret-that-is-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:4000",
  BETTER_AUTH_API_KEY: undefined,
  BETTER_AUTH_TRUSTED_ORIGINS: ["http://localhost:3000"],
  TRUSTED_PROXY_IPS: ["loopback"],
  GOOGLE_CLIENT_ID: undefined,
  GOOGLE_CLIENT_SECRET: undefined,
  RESEND_API_KEY: undefined,
  EMAIL_FROM: undefined,
  EMAIL_REPLY_TO: undefined,
  R2_ACCOUNT_ID: undefined,
  R2_ACCESS_KEY_ID: undefined,
  R2_SECRET_ACCESS_KEY: undefined,
  R2_BUCKET_NAME: undefined,
  R2_ENDPOINT: undefined,
  AI_PROVIDER: undefined,
  AI_PROVIDER_API_KEY: undefined,
  AI_MODEL: "gemini-test",
} as const;

const claim: ResumeClaim = {
  id: "claim_verified",
  category: "skills",
  label: "Design systems",
  value: "Led design-system work across four products.",
  sourceText: "Led design-system work across four products.",
  pageNumber: 1,
  userAdded: false,
  status: "confirmed",
  order: 0,
};

let signUpClient = 60;

async function signUp(agent: ReturnType<typeof request.agent>, email: string) {
  signUpClient += 1;
  const response = await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", environment.WEB_ORIGIN)
    .set("X-Forwarded-For", `192.0.2.${signUpClient}`)
    .send({ name: "Resume Owner", email, password: "strong-password-123" })
    .expect(200);
  return response.body.user.id as string;
}

async function verifiedResume(
  repository: ReturnType<typeof createMemoryResumeExtractionRepository>,
  userId: string,
) {
  await repository.createQueued({
    userId,
    resumeId: "resume_verified",
    importId: "import_1",
    objectKey: "private/resume.pdf",
    mimeType: "application/pdf",
  });
  const claimed = await repository.claimNext();
  const reviewed = await repository.complete(
    claimed!.id,
    claimed!.processingToken!,
    [claim],
  );
  await repository.updateClaims(
    userId,
    "resume_verified",
    [claim],
    reviewed!.revision,
  );
}

function analyzer(): JobDescriptionAnalyzer {
  return {
    analyze: vi.fn(async () => ({
      analysis: {
        summary: "One grounded requirement analyzed.",
        requirements: [
          {
            id: "requirement_1",
            category: "responsibility" as const,
            priority: "required" as const,
            label: "Lead design systems",
            sourceQuote: "lead design systems across product teams",
          },
        ],
        matches: [
          {
            requirementId: "requirement_1",
            status: "strong" as const,
            resumeClaimIds: [claim.id],
            explanation:
              "Verified evidence directly supports this requirement.",
          },
        ],
      },
      provider: "gemini",
      model: "gemini-test",
      promptVersion: "job-analysis-v1",
    })),
  };
}

describe("job descriptions", () => {
  it("requires authentication and a verified owned resume", async () => {
    const authRuntime = createAuthRuntime(environment);
    const app = createApp(environment, authRuntime.auth, false, undefined, {
      repository: createMemoryJobDescriptionRepository(),
      extractionRepository: createMemoryResumeExtractionRepository(),
      rateLimiter: createMemoryJobAnalysisRateLimiter(),
    });
    await request(app)
      .post("/api/v1/job-descriptions")
      .send({ resumeId: "resume_1", rawText: "x".repeat(120) })
      .expect(401);

    const owner = request.agent(app);
    await signUp(owner, "unverified@example.com");
    const response = await owner
      .post("/api/v1/job-descriptions")
      .send({ resumeId: "resume_1", rawText: "x".repeat(120) })
      .expect(409);
    expect(response.body.error.code).toBe("VERIFIED_RESUME_REQUIRED");
    await authRuntime.close();
  });

  it("queues analysis, snapshots the verified version, and preserves ownership", async () => {
    const authRuntime = createAuthRuntime(environment);
    const extractionRepository = createMemoryResumeExtractionRepository();
    const jobRepository = createMemoryJobDescriptionRepository();
    const jobAnalyzer = analyzer();
    const app = createApp(environment, authRuntime.auth, false, undefined, {
      repository: jobRepository,
      extractionRepository,
      rateLimiter: createMemoryJobAnalysisRateLimiter(),
    });
    const owner = request.agent(app);
    const stranger = request.agent(app);
    const ownerId = await signUp(owner, "job-owner@example.com");
    await signUp(stranger, "job-stranger@example.com");
    await verifiedResume(extractionRepository, ownerId);

    const created = await owner
      .post("/api/v1/job-descriptions")
      .send({
        resumeId: "resume_verified",
        role: "Product Designer",
        company: "Acme",
        rawText:
          "You will lead design systems across product teams and establish accessible component standards for the company.",
      })
      .expect(202);
    expect(created.body.data).toMatchObject({
      status: "queued",
      role: "Product Designer",
      evidenceClaims: [claim],
    });
    expect(jobAnalyzer.analyze).not.toHaveBeenCalled();
    const service = createJobDescriptionAnalysisService(
      jobRepository,
      jobAnalyzer,
      createLogger(environment),
    );
    await expect(service.processNext()).resolves.toBe(true);
    const completed = await owner
      .get(`/api/v1/job-descriptions/${created.body.data.id}`)
      .expect(200);
    expect(completed.body.data.status).toBe("completed");
    expect(jobAnalyzer.analyze).toHaveBeenCalledWith(
      expect.objectContaining({ resumeClaims: [claim] }),
    );
    await stranger
      .get(`/api/v1/job-descriptions/${created.body.data.id}`)
      .expect(404);
    await authRuntime.close();
  });

  it("rate limits both creation and retry and prevents concurrent analyses", async () => {
    const authRuntime = createAuthRuntime(environment);
    const extractionRepository = createMemoryResumeExtractionRepository();
    const jobRepository = createMemoryJobDescriptionRepository();
    const deniedLimiter = {
      consume: vi.fn(async () => ({ allowed: false, retryAfterSeconds: 120 })),
    };
    const app = createApp(environment, authRuntime.auth, false, undefined, {
      repository: jobRepository,
      extractionRepository,
      rateLimiter: deniedLimiter,
    });
    const owner = request.agent(app);
    const ownerId = await signUp(owner, "rate-limited@example.com");
    await verifiedResume(extractionRepository, ownerId);

    const limited = await owner
      .post("/api/v1/job-descriptions")
      .send({ resumeId: "resume_verified", rawText: "x".repeat(120) })
      .expect(429);
    expect(limited.headers["retry-after"]).toBe("120");

    const failed = await jobRepository.create({
      userId: ownerId,
      resumeId: "resume_verified",
      resumeVersionId: "version_1",
      evidenceClaims: [claim],
      rawText: "x".repeat(120),
    });
    const claimed = await jobRepository.claimNext();
    await jobRepository.fail(
      failed.id,
      claimed!.processingToken!,
      "Try again.",
    );
    await owner
      .post(`/api/v1/job-descriptions/${failed.id}/analyze`)
      .expect(429);
    expect(deniedLimiter.consume).toHaveBeenCalledTimes(2);
    await authRuntime.close();
  });

  it("rejects a second queued analysis for the same user", async () => {
    const authRuntime = createAuthRuntime(environment);
    const extractionRepository = createMemoryResumeExtractionRepository();
    const jobRepository = createMemoryJobDescriptionRepository();
    const app = createApp(environment, authRuntime.auth, false, undefined, {
      repository: jobRepository,
      extractionRepository,
      rateLimiter: createMemoryJobAnalysisRateLimiter(),
    });
    const owner = request.agent(app);
    const ownerId = await signUp(owner, "concurrent@example.com");
    await verifiedResume(extractionRepository, ownerId);
    const body = { resumeId: "resume_verified", rawText: "x".repeat(120) };
    await owner.post("/api/v1/job-descriptions").send(body).expect(202);
    const response = await owner
      .post("/api/v1/job-descriptions")
      .send(body)
      .expect(409);
    expect(response.body.error.code).toBe("AI_ANALYSIS_ALREADY_ACTIVE");
    await authRuntime.close();
  });

  it("hydrates an older failed record only from the same verified version", async () => {
    const authRuntime = createAuthRuntime(environment);
    const extractionRepository = createMemoryResumeExtractionRepository();
    const jobRepository = createMemoryJobDescriptionRepository();
    const app = createApp(environment, authRuntime.auth, false, undefined, {
      repository: jobRepository,
      extractionRepository,
      rateLimiter: createMemoryJobAnalysisRateLimiter(),
    });
    const owner = request.agent(app);
    const ownerId = await signUp(owner, "legacy-analysis@example.com");
    await verifiedResume(extractionRepository, ownerId);
    const extraction = await extractionRepository.findOwned(
      ownerId,
      "resume_verified",
    );
    const legacy = await jobRepository.create({
      userId: ownerId,
      resumeId: "resume_verified",
      resumeVersionId: extraction!.versionId!,
      evidenceClaims: [],
      rawText: "x".repeat(120),
    });
    const claimed = await jobRepository.claimNext();
    const failed = await jobRepository.fail(
      legacy.id,
      claimed!.processingToken!,
      "Try again.",
    );

    const response = await owner
      .post(`/api/v1/job-descriptions/${failed!.id}/analyze`)
      .expect(202);

    expect(response.body.data).toMatchObject({
      status: "queued",
      evidenceClaims: [claim],
    });
    await authRuntime.close();
  });
});
