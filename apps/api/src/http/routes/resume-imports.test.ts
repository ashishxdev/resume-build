import type { ResumeMimeType } from "@make-my-resume/contracts";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app/create-app.js";
import { createAuthRuntime } from "../../infrastructure/auth/auth.js";
import type {
  ResumeObjectStorage,
  StoredObjectInspection,
} from "../../infrastructure/storage/r2-object-storage.js";
import { createMemoryResumeImportRepository } from "../../modules/resumes/resume-import-repository.js";

const testEnvironment = {
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
  TRUSTED_PROXY_IPS: ["loopback"] as string[],
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
} as const;

function createStorage() {
  let inspection: StoredObjectInspection = {
    detectedMimeType: "application/pdf",
    etag: "verified-etag",
    reportedMimeType: "application/pdf",
    size: 245,
  };
  const deletedKeys: string[] = [];
  const storage: ResumeObjectStorage = {
    createUploadUrl: vi.fn(async () => ({
      uploadUrl: "https://example.r2.cloudflarestorage.com/signed-upload",
      expiresAt: "2026-10-02T12:15:00.000Z",
    })),
    async inspectObject() {
      return inspection;
    },
    async deleteObject(objectKey) {
      deletedKeys.push(objectKey);
    },
  };

  return {
    storage,
    deletedKeys,
    setInspection(value: StoredObjectInspection) {
      inspection = value;
    },
  };
}

let signUpClient = 0;

async function signUp(agent: ReturnType<typeof request.agent>, email: string) {
  signUpClient += 1;
  await agent
    .post("/api/auth/sign-up/email")
    .set("Origin", testEnvironment.WEB_ORIGIN)
    .set("X-Forwarded-For", `192.0.2.${signUpClient}`)
    .send({ name: "Resume Owner", email, password: "strong-password-123" })
    .expect(200);
}

describe("resume imports", () => {
  const upload = {
    fileName: "product-designer.pdf",
    mimeType: "application/pdf" as ResumeMimeType,
    size: 245,
    sourceType: "pdf",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("creates, verifies, and lists an owned import", async () => {
    const authRuntime = createAuthRuntime(testEnvironment);
    const repository = createMemoryResumeImportRepository();
    const { storage } = createStorage();
    const app = createApp(testEnvironment, authRuntime.auth, false, {
      repository,
      objectStorage: storage,
    });
    const owner = request.agent(app);
    await signUp(owner, "owner@example.com");

    const created = await owner
      .post("/api/v1/imports")
      .send(upload)
      .expect(201);

    expect(created.body.data).toMatchObject({
      uploadMethod: "PUT",
      uploadHeaders: { "Content-Type": "application/pdf" },
    });
    expect(created.body.data.uploadUrl).toContain("signed-upload");
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({ size: 245 }),
    );

    const completed = await owner
      .post(`/api/v1/imports/${created.body.data.importId}/complete`)
      .expect(202);
    expect(completed.body.data.status).toBe("uploaded");

    const resumes = await owner.get("/api/v1/resumes").expect(200);
    expect(resumes.body.data).toEqual([
      expect.objectContaining({
        name: "product-designer",
        importStatus: "uploaded",
      }),
    ]);
  });

  it("does not expose another user's import", async () => {
    const authRuntime = createAuthRuntime(testEnvironment);
    const repository = createMemoryResumeImportRepository();
    const { storage } = createStorage();
    const app = createApp(testEnvironment, authRuntime.auth, false, {
      repository,
      objectStorage: storage,
    });
    const owner = request.agent(app);
    const stranger = request.agent(app);
    await signUp(owner, "owner@example.com");
    await signUp(stranger, "stranger@example.com");
    const created = await owner
      .post("/api/v1/imports")
      .send(upload)
      .expect(201);

    await stranger
      .get(`/api/v1/imports/${created.body.data.importId}`)
      .expect(404);
  });

  it("rejects and removes content whose signature does not match", async () => {
    const authRuntime = createAuthRuntime(testEnvironment);
    const repository = createMemoryResumeImportRepository();
    const storageRuntime = createStorage();
    storageRuntime.setInspection({
      detectedMimeType: "image/jpeg",
      etag: "mismatch",
      reportedMimeType: "application/pdf",
      size: 245,
    });
    const app = createApp(testEnvironment, authRuntime.auth, false, {
      repository,
      objectStorage: storageRuntime.storage,
    });
    const owner = request.agent(app);
    await signUp(owner, "owner@example.com");
    const created = await owner
      .post("/api/v1/imports")
      .send(upload)
      .expect(201);

    const response = await owner
      .post(`/api/v1/imports/${created.body.data.importId}/complete`)
      .expect(422);

    expect(response.body.error.code).toBe("FILE_VALIDATION_FAILED");
    expect(storageRuntime.deletedKeys).toHaveLength(1);
  });

  it.each([
    ["successful", false],
    ["failed", true],
  ])(
    "does not resurrect a cancelled import after %s verification",
    async (_outcome, inspectionFails) => {
      const authRuntime = createAuthRuntime(testEnvironment);
      const repository = createMemoryResumeImportRepository();
      const storageRuntime = createStorage();
      let inspectionStarted!: () => void;
      let finishInspection!: () => void;
      const started = new Promise<void>((resolve) => {
        inspectionStarted = resolve;
      });
      const finish = new Promise<void>((resolve) => {
        finishInspection = resolve;
      });
      storageRuntime.storage.inspectObject = vi.fn(async () => {
        inspectionStarted();
        await finish;
        if (inspectionFails) throw new Error("R2 temporarily unavailable");
        return {
          detectedMimeType: "application/pdf",
          etag: "verified-etag",
          reportedMimeType: "application/pdf",
          size: 245,
        };
      });
      const app = createApp(testEnvironment, authRuntime.auth, false, {
        repository,
        objectStorage: storageRuntime.storage,
      });
      const owner = request.agent(app);
      await signUp(owner, `race-${_outcome}@example.com`);
      const created = await owner
        .post("/api/v1/imports")
        .send(upload)
        .expect(201);

      const completion = owner
        .post(`/api/v1/imports/${created.body.data.importId}/complete`)
        .then((response) => response);
      await started;
      await owner
        .delete(`/api/v1/imports/${created.body.data.importId}`)
        .expect(204);
      finishInspection();

      const completed = await completion;
      expect(completed.status).toBe(409);
      expect(completed.body.error.code).toBe("IMPORT_STATE_CHANGED");
      const imported = await owner
        .get(`/api/v1/imports/${created.body.data.importId}`)
        .expect(200);
      expect(imported.body.data.status).toBe("cancelled");
      expect(storageRuntime.deletedKeys).toHaveLength(1);
    },
  );

  it("requires authentication, complete configuration, and valid metadata", async () => {
    const authRuntime = createAuthRuntime(testEnvironment);
    const repository = createMemoryResumeImportRepository();
    const app = createApp(testEnvironment, authRuntime.auth, false, {
      repository,
      objectStorage: null,
    });

    await request(app).post("/api/v1/imports").send(upload).expect(401);

    const owner = request.agent(app);
    await signUp(owner, "owner@example.com");
    await owner.post("/api/v1/imports").send(upload).expect(503);
  });
});
