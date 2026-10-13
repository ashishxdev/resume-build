import type {
  ResumeImportStatus,
  ResumeMimeType,
  ResumeSourceType,
  ResumeSummary,
} from "@make-my-resume/contracts";
import { MongoClient, type Db } from "mongodb";

import type { Environment } from "../../config/environment.js";
import type { MemoryResumeStore } from "./memory-resume-store.js";

export interface ResumeImportRecord {
  id: string;
  userId: string;
  resumeId: string;
  fileId: string;
  name: string;
  fileName: string;
  mimeType: ResumeMimeType;
  size: number;
  sourceType: ResumeSourceType;
  objectKey: string;
  status: ResumeImportStatus;
  failureCode: string | null;
  etag: string | null;
  cancellationPending?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeImportRepository {
  claimForCancellation(
    userId: string,
    importId: string,
  ): Promise<ResumeImportRecord | null>;
  completeCancellation(
    userId: string,
    importId: string,
  ): Promise<ResumeImportRecord | null>;
  releaseCancellation(userId: string, importId: string): Promise<void>;
  claimForVerification(
    userId: string,
    importId: string,
  ): Promise<ResumeImportRecord | null>;
  create(record: ResumeImportRecord): Promise<void>;
  findOwned(
    userId: string,
    importId: string,
  ): Promise<ResumeImportRecord | null>;
  findOwnedByResumeId(
    userId: string,
    resumeId: string,
  ): Promise<ResumeImportRecord | null>;
  findOwnedResume(
    userId: string,
    resumeId: string,
  ): Promise<ResumeImportRecord | null>;
  deleteOwnedResume(userId: string, resumeId: string): Promise<boolean>;
  listResumes(userId: string): Promise<ResumeSummary[]>;
  markFailed(
    userId: string,
    importId: string,
    failureCode: string,
  ): Promise<ResumeImportRecord | null>;
  markUploaded(
    userId: string,
    importId: string,
    etag: string | null,
  ): Promise<ResumeImportRecord | null>;
}

interface ResumeDocument {
  _id: string;
  userId: string;
  name: string;
  baseVersionId: string | null;
  originalFileId: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface FileDocument {
  _id: string;
  userId: string;
  resumeId: string;
  type: "original_resume";
  storageProvider: "cloudflare_r2";
  objectKey: string;
  originalName: string;
  mimeType: ResumeMimeType;
  size: number;
  status: "uploading" | "available" | "failed" | "deleted";
  etag?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toSummary(record: ResumeImportRecord): ResumeSummary {
  const compatibilityStatus = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ].includes(record.mimeType)
    ? "supported"
    : "unsupported_legacy_format";

  return {
    id: record.resumeId,
    name: record.name,
    originalFileName: record.fileName,
    importId: record.id,
    importStatus: record.status,
    extractionStatus: null,
    compatibilityStatus,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function createMemoryResumeImportRepository(
  store?: MemoryResumeStore,
): ResumeImportRepository {
  const records = new Map<string, ResumeImportRecord>();

  return {
    async create(record) {
      records.set(record.id, structuredClone(record));
      store?.resumeNames.set(record.resumeId, record.name);
      store?.activeVersionIds.set(record.resumeId, null);
    },

    async findOwned(userId, importId) {
      const record = records.get(importId);
      return record?.userId === userId ? structuredClone(record) : null;
    },

    async findOwnedByResumeId(userId, resumeId) {
      const record = [...records.values()].find(
        (candidate) =>
          candidate.userId === userId &&
          candidate.resumeId === resumeId &&
          candidate.status === "uploaded",
      );
      return record ? structuredClone(record) : null;
    },

    async findOwnedResume(userId, resumeId) {
      const record = [...records.values()].find(
        (candidate) =>
          candidate.userId === userId &&
          candidate.resumeId === resumeId &&
          candidate.status !== "cancelled",
      );
      return record ? structuredClone(record) : null;
    },

    async deleteOwnedResume(userId, resumeId) {
      const recordsToDelete = [...records.values()].filter(
        (candidate) =>
          candidate.userId === userId && candidate.resumeId === resumeId,
      );
      for (const record of recordsToDelete) records.delete(record.id);
      store?.resumeNames.delete(resumeId);
      store?.activeVersionIds.delete(resumeId);
      store?.versions.delete(resumeId);
      return recordsToDelete.length > 0;
    },

    async listResumes(userId) {
      return [...records.values()]
        .filter(
          (record) => record.userId === userId && record.status !== "cancelled",
        )
        .sort(
          (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
        )
        .map(toSummary);
    },

    async claimForVerification(userId, importId) {
      const record = records.get(importId);
      if (
        !record ||
        record.userId !== userId ||
        record.cancellationPending ||
        record.status !== "awaiting_upload"
      ) {
        return null;
      }
      record.status = "verifying";
      record.updatedAt = new Date();
      return structuredClone(record);
    },

    async markUploaded(userId, importId, etag) {
      const record = records.get(importId);
      if (
        !record ||
        record.userId !== userId ||
        record.cancellationPending ||
        record.status !== "verifying"
      ) {
        return null;
      }
      record.status = "uploaded";
      record.etag = etag;
      record.failureCode = null;
      record.updatedAt = new Date();
      return structuredClone(record);
    },

    async markFailed(userId, importId, failureCode) {
      const record = records.get(importId);
      if (
        !record ||
        record.userId !== userId ||
        record.cancellationPending ||
        record.status !== "verifying"
      ) {
        return null;
      }
      record.status = "failed";
      record.failureCode = failureCode;
      record.updatedAt = new Date();
      return structuredClone(record);
    },

    async claimForCancellation(userId, importId) {
      const record = records.get(importId);
      if (
        record?.userId === userId &&
        record.cancellationPending &&
        ["awaiting_upload", "verifying", "failed"].includes(record.status)
      ) {
        return structuredClone(record);
      }
      if (
        !record ||
        record.userId !== userId ||
        record.status === "uploaded" ||
        record.status === "cancelled"
      ) {
        return null;
      }
      record.cancellationPending = true;
      record.updatedAt = new Date();
      return structuredClone(record);
    },

    async completeCancellation(userId, importId) {
      const record = records.get(importId);
      if (!record || record.userId !== userId || !record.cancellationPending) {
        return null;
      }
      record.status = "cancelled";
      record.cancellationPending = false;
      record.updatedAt = new Date();
      return structuredClone(record);
    },

    async releaseCancellation(userId, importId) {
      const record = records.get(importId);
      if (!record || record.userId !== userId || !record.cancellationPending)
        return;
      record.cancellationPending = false;
      record.updatedAt = new Date();
    },
  };
}

function createMongoResumeImportRepository(
  database: Db,
): ResumeImportRepository {
  const imports = database.collection<ResumeImportRecord>("resume_imports");
  const resumes = database.collection<ResumeDocument>("resumes");
  const files = database.collection<FileDocument>("files");
  const versions = database.collection<{
    _id: string;
    resumeId: string;
    userId: string;
  }>("resume_versions");

  return {
    async create(record) {
      await imports.insertOne(record);
      try {
        await Promise.all([
          resumes.insertOne({
            _id: record.resumeId,
            userId: record.userId,
            name: record.name,
            baseVersionId: null,
            originalFileId: record.fileId,
            isDeleted: false,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          }),
          files.insertOne({
            _id: record.fileId,
            userId: record.userId,
            resumeId: record.resumeId,
            type: "original_resume",
            storageProvider: "cloudflare_r2",
            objectKey: record.objectKey,
            originalName: record.fileName,
            mimeType: record.mimeType,
            size: record.size,
            status: "uploading",
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
          }),
        ]);
      } catch (error) {
        await Promise.allSettled([
          imports.deleteOne({ id: record.id, userId: record.userId }),
          resumes.deleteOne({ _id: record.resumeId, userId: record.userId }),
          files.deleteOne({ _id: record.fileId, userId: record.userId }),
        ]);
        throw error;
      }
    },

    async findOwned(userId, importId) {
      return imports.findOne({ id: importId, userId });
    },

    async findOwnedByResumeId(userId, resumeId) {
      return imports.findOne(
        { userId, resumeId, status: "uploaded" },
        { sort: { updatedAt: -1 } },
      );
    },

    async findOwnedResume(userId, resumeId) {
      return imports.findOne(
        { userId, resumeId, status: { $ne: "cancelled" } },
        { sort: { updatedAt: -1 } },
      );
    },

    async deleteOwnedResume(userId, resumeId) {
      const record = await imports.findOne({ userId, resumeId });
      if (!record) return false;

      // Keep the import record until last so a partial cleanup can be retried.
      await versions.deleteMany({ userId, resumeId });
      await files.deleteMany({ userId, resumeId });
      await resumes.deleteOne({ _id: resumeId, userId });
      const result = await imports.deleteMany({ userId, resumeId });
      return result.deletedCount > 0;
    },

    async listResumes(userId) {
      return imports
        .find({ userId, status: { $ne: "cancelled" } })
        .sort({ updatedAt: -1 })
        .toArray()
        .then((records) => records.map(toSummary));
    },

    async claimForVerification(userId, importId) {
      return imports.findOneAndUpdate(
        {
          id: importId,
          userId,
          status: "awaiting_upload",
          cancellationPending: { $ne: true },
        },
        { $set: { status: "verifying", updatedAt: new Date() } },
        { returnDocument: "after" },
      );
    },

    async markUploaded(userId, importId, etag) {
      const updatedAt = new Date();
      const record = await imports.findOneAndUpdate(
        {
          id: importId,
          userId,
          status: "verifying",
          cancellationPending: { $ne: true },
        },
        {
          $set: {
            status: "uploaded",
            failureCode: null,
            etag,
            updatedAt,
          },
        },
        { returnDocument: "after" },
      );
      if (record) {
        await Promise.all([
          files.updateOne(
            { _id: record.fileId, userId, status: "uploading" },
            { $set: { status: "available", etag, updatedAt } },
          ),
          resumes.updateOne(
            { _id: record.resumeId, userId },
            { $set: { updatedAt } },
          ),
        ]);
      }
      return record;
    },

    async markFailed(userId, importId, failureCode) {
      const updatedAt = new Date();
      const record = await imports.findOneAndUpdate(
        {
          id: importId,
          userId,
          status: "verifying",
          cancellationPending: { $ne: true },
        },
        { $set: { status: "failed", failureCode, updatedAt } },
        { returnDocument: "after" },
      );
      if (record) {
        await files.updateOne(
          { _id: record.fileId, userId, status: "uploading" },
          { $set: { status: "failed", updatedAt } },
        );
      }
      return record;
    },

    async claimForCancellation(userId, importId) {
      return imports.findOneAndUpdate(
        {
          id: importId,
          userId,
          status: { $in: ["awaiting_upload", "verifying", "failed"] },
        },
        { $set: { cancellationPending: true, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
    },

    async completeCancellation(userId, importId) {
      const updatedAt = new Date();
      const record = await imports.findOneAndUpdate(
        {
          id: importId,
          userId,
          status: { $in: ["awaiting_upload", "verifying", "failed"] },
          cancellationPending: true,
        },
        {
          $set: {
            status: "cancelled",
            cancellationPending: false,
            updatedAt,
          },
        },
        { returnDocument: "after" },
      );
      if (record) {
        await Promise.all([
          files.updateOne(
            { _id: record.fileId, userId },
            { $set: { status: "deleted", updatedAt } },
          ),
          resumes.updateOne(
            { _id: record.resumeId, userId },
            { $set: { isDeleted: true, updatedAt } },
          ),
        ]);
      }
      return record;
    },

    async releaseCancellation(userId, importId) {
      await imports.updateOne(
        { id: importId, userId, cancellationPending: true },
        {
          $unset: { cancellationPending: "" },
          $set: { updatedAt: new Date() },
        },
      );
    },
  };
}

export function createResumeImportRepositoryRuntime(
  environment: Environment,
  memoryStore?: MemoryResumeStore,
) {
  if (environment.AUTH_STORAGE !== "mongodb" || !environment.MONGODB_URI) {
    return {
      repository: createMemoryResumeImportRepository(memoryStore),
      close: async () => {},
    };
  }

  const client = new MongoClient(environment.MONGODB_URI);
  return {
    repository: createMongoResumeImportRepository(
      client.db(environment.MONGODB_DATABASE),
    ),
    close: async () => client.close(),
  };
}
