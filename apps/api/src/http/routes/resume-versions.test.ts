import {
  DEFAULT_RESUME_PRESENTATION,
  type ResumeClaim,
} from "@make-my-resume/contracts";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createResumeVersionRouter } from "./resume-versions.js";
import type { Auth } from "../../infrastructure/auth/auth.js";
import { createMemoryResumeImportRepository } from "../../modules/resumes/resume-import-repository.js";
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
  const createdAt =
    input.type === "base"
      ? new Date("2026-10-01T08:00:00.000Z")
      : new Date("2026-10-02T08:00:00.000Z");
  return {
    id: input.id,
    resumeId: "resume_1",
    userId: "user_1",
    name: input.type === "base" ? "Verified baseline" : "Acme Engineer",
    type: input.type,
    sourceVersionId: input.type === "base" ? null : "version_base",
    jobDescriptionId: input.type === "base" ? null : "job_1",
    tailoringSessionId: input.tailoringSessionId ?? null,
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

function createTestApp(userId: string | null) {
  const repository = createMemoryResumeVersionRepository([
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
    createResumeVersionRouter(authFor(userId), {
      repository,
      resumeImportRepository: createMemoryResumeImportRepository(),
    }),
  );
  return { app, repository };
}

describe("resume version routes", () => {
  it("lists owner-only immutable history with truthful protections", async () => {
    const { app } = createTestApp("user_1");
    const response = await request(app)
      .get("/api/v1/resumes/resume_1/versions")
      .expect(200);

    expect(response.body.data).toMatchObject({
      resumeName: "Engineering Resume",
      activeVersionId: "version_tailored",
    });
    expect(response.body.data.versions).toEqual([
      expect.objectContaining({
        id: "version_base",
        versionNumber: 1,
        canDelete: false,
        deleteBlockedReason: expect.stringMatching(/baseline/i),
      }),
      expect.objectContaining({
        id: "version_tailored",
        versionNumber: 2,
        isActive: true,
        canDelete: false,
      }),
    ]);

    const stranger = createTestApp("user_2").app;
    await request(stranger)
      .get("/api/v1/resumes/resume_1/versions")
      .expect(404);
    await request(createTestApp(null).app)
      .get("/api/v1/resumes/resume_1/versions")
      .expect(401);
  });

  it("renames, activates, restores, and safely deletes a derived copy", async () => {
    const { app } = createTestApp("user_1");

    const renamed = await request(app)
      .patch("/api/v1/resumes/resume_1/versions/version_tailored")
      .send({ name: "Acme application" })
      .expect(200);
    expect(renamed.body.data.name).toBe("Acme application");

    await request(app)
      .post("/api/v1/resumes/resume_1/versions/version_base/activate")
      .expect(200);

    const restored = await request(app)
      .post("/api/v1/resumes/resume_1/versions/version_tailored/restore")
      .expect(201);
    expect(restored.body.data).toMatchObject({
      type: "restored",
      sourceVersionId: "version_tailored",
      isActive: true,
    });

    await request(app)
      .delete(
        `/api/v1/resumes/resume_1/versions/${restored.body.data.id as string}`,
      )
      .expect(409);

    await request(app)
      .post("/api/v1/resumes/resume_1/versions/version_base/activate")
      .expect(200);
    await request(app)
      .delete(
        `/api/v1/resumes/resume_1/versions/${restored.body.data.id as string}`,
      )
      .expect(204);

    const history = await request(app)
      .get("/api/v1/resumes/resume_1/versions")
      .expect(200);
    expect(history.body.data.versions).toHaveLength(2);
    expect(history.body.data.activeVersionId).toBe("version_base");
  });

  it("keeps the verified baseline protected", async () => {
    const { app } = createTestApp("user_1");
    const response = await request(app)
      .delete("/api/v1/resumes/resume_1/versions/version_base")
      .expect(409);
    expect(response.body.error.code).toBe("BASE_VERSION_PROTECTED");
  });

  it("persists owner-only presentation settings for preview and export", async () => {
    const { app } = createTestApp("user_1");
    const presentation = {
      ...DEFAULT_RESUME_PRESENTATION,
      template: "modern" as const,
      fontFamily: "sans" as const,
      accentColor: "navy" as const,
      density: "compact" as const,
      sectionOrder: ["skills", "experience"] as const,
      hiddenSections: ["achievements"] as const,
    };

    const response = await request(app)
      .patch("/api/v1/resumes/resume_1/versions/version_tailored/presentation")
      .send(presentation)
      .expect(200);

    expect(response.body.data.presentation).toEqual(presentation);
    const version = await request(app)
      .get("/api/v1/resumes/resume_1/versions/version_tailored")
      .expect(200);
    expect(version.body.data.presentation).toEqual(presentation);

    const hiddenAll = await request(app)
      .patch("/api/v1/resumes/resume_1/versions/version_tailored/presentation")
      .send({
        ...DEFAULT_RESUME_PRESENTATION,
        hiddenSections: ["experience"],
      })
      .expect(400);
    expect(hiddenAll.body.error.code).toBe("ALL_SECTIONS_HIDDEN");

    await request(createTestApp("user_2").app)
      .patch("/api/v1/resumes/resume_1/versions/version_tailored/presentation")
      .send(presentation)
      .expect(404);
  });

  it("exports an owned historical snapshot with private download headers", async () => {
    const { app } = createTestApp("user_1");
    const response = await request(app)
      .get(
        "/api/v1/resumes/resume_1/versions/version_tailored/export?format=docx&density=compact",
      )
      .expect(200);

    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.headers["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers["content-disposition"]).toContain(
      'filename="acme-engineer.docx"',
    );
    expect(Number(response.headers["content-length"])).toBeGreaterThan(500);
  });
});
