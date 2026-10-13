import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createResumeShareRouter } from "../../http/routes/resume-shares.js";
import type { Auth } from "../../infrastructure/auth/auth.js";
import { createMemoryTailoringRepository } from "../tailoring/tailoring-repository.js";
import { createMemoryResumeExtractionRepository } from "./resume-extraction-repository.js";
import { createMemoryResumeImportRepository } from "./resume-import-repository.js";
import { createMemoryResumeStore } from "./memory-resume-store.js";
import { createMemoryResumeShareRepository } from "./resume-share-repository.js";
import { createMemoryResumeVersionRepository } from "./resume-version-repository.js";

const claim = {
  id: "claim_1",
  category: "experience" as const,
  label: "Experience",
  value: "Built reliable services",
  sourceText: "Built reliable services",
  pageNumber: 1,
  status: "confirmed" as const,
  userAdded: false,
  order: 0,
};

describe("shared in-memory resume store", () => {
  it("exposes verified and tailored versions through version history", async () => {
    const store = createMemoryResumeStore();
    const imports = createMemoryResumeImportRepository(store);
    const extractions = createMemoryResumeExtractionRepository(store);
    const tailoring = createMemoryTailoringRepository(store);
    const versions = createMemoryResumeVersionRepository([], tailoring, store);
    const now = new Date();

    await imports.create({
      id: "import_1",
      userId: "user_1",
      resumeId: "resume_1",
      fileId: "file_1",
      name: "Engineering Resume",
      fileName: "resume.pdf",
      mimeType: "application/pdf",
      size: 100,
      sourceType: "pdf",
      objectKey: "users/user_1/resumes/resume_1/original/file_1.pdf",
      status: "uploaded",
      failureCode: null,
      etag: "etag",
      createdAt: now,
      updatedAt: now,
    });
    const queued = await extractions.createQueued({
      userId: "user_1",
      resumeId: "resume_1",
      importId: "import_1",
      objectKey: "users/user_1/resumes/resume_1/original/file_1.pdf",
      mimeType: "application/pdf",
    });
    const processing = await extractions.claimNext();
    const review = await extractions.complete(
      queued.id,
      processing!.processingToken!,
      [{ ...claim, status: "unreviewed" }],
    );
    const verified = await extractions.updateClaims(
      "user_1",
      "resume_1",
      [claim],
      review!.revision,
    );

    const baselineHistory = await versions.listOwned("user_1", "resume_1");
    expect(baselineHistory).toMatchObject({
      resumeName: "Engineering Resume",
      versions: [
        expect.objectContaining({
          id: verified!.versionId,
          type: "base",
        }),
      ],
    });

    const shareRepository = createMemoryResumeShareRepository();
    const shareApp = express();
    shareApp.use(express.json());
    shareApp.use(
      createResumeShareRouter(
        {
          api: {
            getSession: async () => ({ user: { id: "user_1" } }),
          },
        } as unknown as Auth,
        {
          repository: shareRepository,
          resumeVersionRepository: versions,
          resumeImportRepository: imports,
        },
      ),
    );
    await request(shareApp)
      .post(`/api/v1/resumes/resume_1/versions/${verified!.versionId}/share`)
      .expect(201);

    const session = await tailoring.create({
      userId: "user_1",
      jobDescriptionId: "job_1",
      resumeId: "resume_1",
      resumeVersionId: verified!.versionId!,
      role: "Engineer",
      company: "Acme",
      rawJobDescription: "Build reliable services",
      analysis: {
        requirements: [],
        summary: "Engineering role",
        matches: [],
      },
      evidenceClaims: [claim],
    });
    const generating = await tailoring.claimNext();
    const reviewSession = await tailoring.generated(
      session.id,
      generating!.processingToken!,
      {
        suggestions: [],
        provider: "test",
        model: "test",
        promptVersion: "test",
      },
    );
    await tailoring.complete("user_1", session.id, reviewSession!.revision);

    const completeHistory = await versions.listOwned("user_1", "resume_1");
    expect(completeHistory?.versions.map((version) => version.type)).toEqual([
      "base",
      "tailored",
    ]);
  });
});
