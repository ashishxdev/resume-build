import {
  DEFAULT_RESUME_PRESENTATION,
  type ResumeClaim,
} from "@make-my-resume/contracts";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import {
  createResumeShareRouter,
  type ResumeShareRouteServices,
} from "./resume-shares.js";
import type { Auth } from "../../infrastructure/auth/auth.js";
import { createMemoryResumeImportRepository } from "../../modules/resumes/resume-import-repository.js";
import { createMemoryResumeShareRepository } from "../../modules/resumes/resume-share-repository.js";
import { publicResumeExportRequestsPerMinute } from "../../modules/resumes/public-resume-export-protection.js";
import {
  createMemoryResumeVersionRepository,
  type ResumeVersionRecord,
} from "../../modules/resumes/resume-version-repository.js";

const claim: ResumeClaim = {
  id: "claim_1",
  category: "experience",
  label: "Software Engineer at Acme",
  value: "Built reliable APIs.",
  sourceText: "Built reliable APIs.",
  pageNumber: 1,
  status: "confirmed",
  userAdded: false,
  order: 0,
};

function version(
  input: Partial<ResumeVersionRecord> &
    Pick<ResumeVersionRecord, "id" | "type">,
): ResumeVersionRecord {
  const createdAt = new Date("2026-10-02T08:00:00.000Z");
  return {
    id: input.id,
    resumeId: "resume_1",
    userId: "user_1",
    name: input.type === "base" ? "Verified baseline" : "Acme Engineer",
    type: input.type,
    sourceVersionId: input.type === "base" ? null : "version_base",
    jobDescriptionId: input.type === "base" ? null : "job_1",
    tailoringSessionId: null,
    company: input.type === "base" ? null : "Acme",
    role: input.type === "base" ? null : "Engineer",
    claims: [claim],
    presentation: DEFAULT_RESUME_PRESENTATION,
    createdAt,
    updatedAt: createdAt,
    ...input,
  };
}

function authFor(userId: string | null) {
  return {
    api: {
      getSession: async () =>
        userId
          ? { user: { id: userId, email: `${userId}@example.com` } }
          : null,
    },
  } as unknown as Auth;
}

function createTestApp(
  userId: string | null,
  overrides: Partial<ResumeShareRouteServices> = {},
) {
  const shareRepository = createMemoryResumeShareRepository();
  const versionRepository = createMemoryResumeVersionRepository([
    {
      resumeId: "resume_1",
      resumeName: "Engineering Resume",
      activeVersionId: "version_tailored",
      versions: [
        version({ id: "version_base", type: "base" }),
        version({ id: "version_tailored", type: "tailored" }),
      ],
    },
  ]);
  const app = express();
  app.use(express.json());
  app.use(
    createResumeShareRouter(authFor(userId), {
      repository: shareRepository,
      resumeVersionRepository: versionRepository,
      resumeImportRepository: createMemoryResumeImportRepository(),
      ...overrides,
    }),
  );
  return app;
}

const ownerPath = "/api/v1/resumes/resume_1/versions/version_tailored/share";

describe("resume share routes", () => {
  it("creates an idempotent owner-only link for one immutable version", async () => {
    const app = createTestApp("user_1");
    const created = await request(app).post(ownerPath).expect(201);

    expect(created.headers["cache-control"]).toBe("private, no-store");
    expect(created.body.data).toMatchObject({
      resumeId: "resume_1",
      versionId: "version_tailored",
      enabled: true,
    });
    expect(created.body.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const repeated = await request(app).post(ownerPath).expect(200);
    expect(repeated.body.data.token).toBe(created.body.data.token);

    const status = await request(app).get(ownerPath).expect(200);
    expect(status.body.data.token).toBe(created.body.data.token);

    await request(createTestApp("user_2")).post(ownerPath).expect(404);
    await request(createTestApp(null)).post(ownerPath).expect(401);
  });

  it("renders only the selected version publicly and downloads its PDF", async () => {
    const app = createTestApp("user_1");
    const created = await request(app).post(ownerPath).expect(201);
    const token = created.body.data.token as string;

    const publicPage = await request(app)
      .get(`/api/v1/public/resumes/${token}`)
      .expect(200);
    expect(publicPage.headers["cache-control"]).toBe("no-store, max-age=0");
    expect(publicPage.body.data).toMatchObject({
      versionName: "Acme Engineer",
      document: {
        sections: [
          expect.objectContaining({
            kind: "experience",
            items: [expect.objectContaining({ body: "Built reliable APIs." })],
          }),
        ],
      },
      presentation: DEFAULT_RESUME_PRESENTATION,
    });
    expect(publicPage.body.data).not.toHaveProperty("userId");
    expect(publicPage.body.data).not.toHaveProperty("claims");

    const exported = await request(app)
      .get(`/api/v1/public/resumes/${token}/export`)
      .expect(200);
    expect(exported.headers["cache-control"]).toBe("no-store, max-age=0");
    expect(exported.headers["content-type"]).toContain("application/pdf");
    expect(exported.headers["content-disposition"]).toContain(
      'filename="acme-engineer.pdf"',
    );
    expect(Number(exported.headers["content-length"])).toBeGreaterThan(500);
  });

  it("rate limits repeated public PDF exports", async () => {
    const app = createTestApp("user_1");
    const created = await request(app).post(ownerPath).expect(201);
    const exportPath = `/api/v1/public/resumes/${created.body.data.token}/export`;

    for (
      let attempt = 0;
      attempt < publicResumeExportRequestsPerMinute;
      attempt += 1
    ) {
      await request(app).get(exportPath).expect(200);
    }
    const limited = await request(app).get(exportPath).expect(429);
    expect(limited.body.error.code).toBe("PUBLIC_EXPORT_RATE_LIMITED");
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("validates share tokens before creating export rate-limit state", async () => {
    const consume = vi.fn(() => ({ allowed: true, retryAfterSeconds: 60 }));
    const app = createTestApp(null, {
      publicExportRateLimiter: { consume },
    });

    await request(app)
      .get(`/api/v1/public/resumes/${"z".repeat(43)}/export`)
      .expect(404);

    expect(consume).not.toHaveBeenCalled();
  });

  it("rate limits valid public previews after resolving the share", async () => {
    const app = createTestApp("user_1", {
      publicPreviewRateLimiter: {
        consume: () => ({ allowed: false, retryAfterSeconds: 12 }),
      },
    });
    const created = await request(app).post(ownerPath).expect(201);

    const limited = await request(app)
      .get(`/api/v1/public/resumes/${created.body.data.token}`)
      .expect(429);
    expect(limited.body.error.code).toBe("PUBLIC_PREVIEW_RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBe("12");
  });

  it("keeps fabricated-token traffic in a separate IP limiter", async () => {
    const exportConsume = vi.fn(() => ({
      allowed: true,
      retryAfterSeconds: 60,
    }));
    const invalidConsume = vi.fn(() => ({
      allowed: false,
      retryAfterSeconds: 20,
    }));
    const app = createTestApp(null, {
      publicExportRateLimiter: { consume: exportConsume },
      invalidPublicRequestRateLimiter: { consume: invalidConsume },
    });

    const limited = await request(app)
      .get(`/api/v1/public/resumes/${"z".repeat(43)}/export`)
      .expect(429);
    expect(limited.body.error.code).toBe("PUBLIC_SHARE_RATE_LIMITED");
    expect(invalidConsume).toHaveBeenCalledWith(
      "invalid-share",
      expect.any(String),
    );
    expect(exportConsume).not.toHaveBeenCalled();
  });

  it("disables immediately and can re-enable the same private link", async () => {
    const app = createTestApp("user_1");
    const created = await request(app).post(ownerPath).expect(201);
    const token = created.body.data.token as string;

    const disabled = await request(app)
      .patch(ownerPath)
      .send({ enabled: false })
      .expect(200);
    expect(disabled.body.data.enabled).toBe(false);

    const unavailable = await request(app)
      .get(`/api/v1/public/resumes/${token}`)
      .expect(404);
    expect(unavailable.body.error.code).toBe("SHARE_UNAVAILABLE");
    expect(unavailable.headers["cache-control"]).toBe("no-store, max-age=0");

    await request(app).patch(ownerPath).send({ enabled: true }).expect(200);
    await request(app).get(`/api/v1/public/resumes/${token}`).expect(200);
  });

  it("regenerates access and invalidates the previous token", async () => {
    const app = createTestApp("user_1");
    const created = await request(app).post(ownerPath).expect(201);
    const oldToken = created.body.data.token as string;

    const regenerated = await request(app)
      .post(`${ownerPath}/regenerate`)
      .expect(200);
    const newToken = regenerated.body.data.token as string;
    expect(newToken).not.toBe(oldToken);
    expect(regenerated.body.data.enabled).toBe(true);

    await request(app).get(`/api/v1/public/resumes/${oldToken}`).expect(404);
    await request(app).get(`/api/v1/public/resumes/${newToken}`).expect(200);
  });

  it("returns one neutral unavailable state for malformed and unknown links", async () => {
    const app = createTestApp(null);
    const malformed = await request(app)
      .get("/api/v1/public/resumes/not-a-valid-token")
      .expect(404);
    const unknown = await request(app)
      .get(`/api/v1/public/resumes/${"a".repeat(43)}`)
      .expect(404);

    expect(malformed.body).toEqual(unknown.body);
    expect(malformed.body.error.message).not.toMatch(/token|version|account/i);
  });
});
