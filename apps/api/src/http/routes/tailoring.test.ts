import type { ResumeClaim } from "@make-my-resume/contracts";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app/create-app.js";
import { createAuthRuntime } from "../../infrastructure/auth/auth.js";
import { createMemoryJobDescriptionRepository } from "../../modules/job-descriptions/job-description-repository.js";
import { createMemoryTailoringRepository } from "../../modules/tailoring/tailoring-repository.js";
import { createTailoringService } from "../../modules/tailoring/tailoring-service.js";
import { createLogger } from "../../shared/logging/logger.js";

const environment = {
  NODE_ENV: "test",
  PORT: 4000,
  LOG_LEVEL: "silent",
  WEB_ORIGIN: "http://localhost:3000",
  AUTH_STORAGE: "memory",
  MONGODB_URI: undefined,
  MONGODB_DATABASE: "tailoring_test",
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
  AI_MODEL: "test",
} as const;

const claim: ResumeClaim = {
  id: "claim_1",
  category: "experience",
  label: "APIs",
  value: "Built APIs with Node.js.",
  sourceText: "Built APIs with Node.js.",
  pageNumber: 1,
  status: "confirmed",
  userAdded: false,
  order: 0,
};

let clientIp = 120;
async function signUp(agent: ReturnType<typeof request.agent>, email: string) {
  clientIp += 1;
  const response = await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", environment.WEB_ORIGIN)
    .set("X-Forwarded-For", `192.0.2.${clientIp}`)
    .send({ name: "Owner", email, password: "strong-password-123" })
    .expect(200);
  return response.body.user.id as string;
}

describe("tailoring routes", () => {
  it("preserves ownership, requires decisions, and saves a separate version", async () => {
    const authRuntime = createAuthRuntime(environment);
    const jobs = createMemoryJobDescriptionRepository();
    const tailoring = createMemoryTailoringRepository();
    const rateLimiter = {
      consume: vi.fn(async () => ({ allowed: true as const })),
    };
    const app = createApp(
      environment,
      authRuntime.auth,
      false,
      undefined,
      undefined,
      {
        repository: tailoring,
        jobDescriptionRepository: jobs,
        rateLimiter,
      },
    );
    const owner = request.agent(app);
    const stranger = request.agent(app);
    const ownerId = await signUp(owner, "tailoring-owner@example.com");
    await signUp(stranger, "tailoring-stranger@example.com");
    const job = await jobs.create({
      userId: ownerId,
      resumeId: "resume_1",
      resumeVersionId: "version_base",
      evidenceClaims: [claim],
      role: "Engineer",
      company: "Acme",
      rawText: "Build REST APIs for customers.",
    });
    const claimedJob = await jobs.claimNext();
    await jobs.complete(job.id, claimedJob!.processingToken!, {
      analysis: {
        summary: "One requirement.",
        requirements: [
          {
            id: "req_1",
            category: "responsibility",
            priority: "required",
            label: "REST APIs",
            sourceQuote: "Build REST APIs",
          },
        ],
        matches: [
          {
            requirementId: "req_1",
            status: "strong",
            resumeClaimIds: [claim.id],
            explanation: "Direct.",
          },
        ],
      },
      provider: "gemini",
      model: "test",
      promptVersion: "v1",
    });
    const created = await owner
      .post(`/api/v1/job-descriptions/${job.id}/tailoring-sessions`)
      .expect(202);
    const id = created.body.data.id as string;
    const reopened = await owner
      .post(`/api/v1/job-descriptions/${job.id}/tailoring-sessions`)
      .expect(200);
    expect(reopened.body.data.id).toBe(id);
    expect(rateLimiter.consume).toHaveBeenCalledTimes(1);
    const generator = {
      generate: vi.fn(async () => ({
        suggestions: [
          {
            id: "suggestion_1",
            sourceClaimId: claim.id,
            requirementIds: ["req_1"],
            section: "experience",
            originalText: claim.value,
            suggestedText: "Built REST APIs with Node.js.",
            reason: "Relevant wording.",
            status: "pending" as const,
            editedText: null,
          },
        ],
        provider: "gemini",
        model: "test",
        promptVersion: "v1",
      })),
    };
    await createTailoringService(
      tailoring,
      generator,
      createLogger(environment),
    ).processNext();
    await stranger.get(`/api/v1/tailoring-sessions/${id}`).expect(404);
    const review = await owner
      .get(`/api/v1/tailoring-sessions/${id}`)
      .expect(200);
    await owner
      .post(`/api/v1/tailoring-sessions/${id}/complete`)
      .send({ revision: review.body.data.revision })
      .expect(409);
    await owner
      .patch(`/api/v1/tailoring-sessions/${id}/suggestions/suggestion_1`)
      .send({
        revision: review.body.data.revision,
        status: "accepted",
        editedText: "Built REST APIs used by 12 products.",
      })
      .expect(400);
    const decided = await owner
      .patch(`/api/v1/tailoring-sessions/${id}/suggestions/suggestion_1`)
      .send({ revision: review.body.data.revision, status: "accepted" })
      .expect(200);
    const completed = await owner
      .post(`/api/v1/tailoring-sessions/${id}/complete`)
      .send({ revision: decided.body.data.revision })
      .expect(200);
    expect(completed.body.data).toMatchObject({
      status: "completed",
      resumeVersionId: "version_base",
    });
    expect(completed.body.data.tailoredVersionId).toMatch(/^version_/);
    await authRuntime.close();
  });
});
