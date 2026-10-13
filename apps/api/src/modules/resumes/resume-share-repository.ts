import { randomBytes } from "node:crypto";

import { MongoClient, MongoServerError, type Db } from "mongodb";

import type { Environment } from "../../config/environment.js";
import { createId } from "../../shared/ids/create-id.js";

export interface ResumeShareRecord {
  id: string;
  userId: string;
  resumeId: string;
  versionId: string;
  token: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeShareRepository {
  findOwnedForVersion(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<ResumeShareRecord | null>;
  createOwned(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<ResumeShareRecord>;
  setEnabledOwned(
    userId: string,
    resumeId: string,
    versionId: string,
    enabled: boolean,
  ): Promise<ResumeShareRecord | null>;
  regenerateOwned(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<ResumeShareRecord | null>;
  findEnabledByToken(token: string): Promise<ResumeShareRecord | null>;
  deleteManyOwnedByVersionIds(
    userId: string,
    resumeId: string,
    versionIds: string[],
  ): Promise<void>;
  deleteManyOwnedByResumeId(userId: string, resumeId: string): Promise<void>;
}

function createShareToken() {
  return randomBytes(32).toString("base64url");
}

function cloneRecord(record: ResumeShareRecord) {
  return structuredClone(record);
}

export function createMemoryResumeShareRepository(
  initial: ResumeShareRecord[] = [],
): ResumeShareRepository {
  const records = new Map(
    initial.map((record) => [record.id, cloneRecord(record)]),
  );

  function owned(userId: string, resumeId: string, versionId: string) {
    return (
      [...records.values()].find(
        (record) =>
          record.userId === userId &&
          record.resumeId === resumeId &&
          record.versionId === versionId,
      ) ?? null
    );
  }

  return {
    async findOwnedForVersion(userId, resumeId, versionId) {
      const record = owned(userId, resumeId, versionId);
      return record ? cloneRecord(record) : null;
    },

    async createOwned(userId, resumeId, versionId) {
      const existing = owned(userId, resumeId, versionId);
      if (existing) {
        existing.enabled = true;
        existing.updatedAt = new Date();
        return cloneRecord(existing);
      }
      const now = new Date();
      const record: ResumeShareRecord = {
        id: createId("share"),
        userId,
        resumeId,
        versionId,
        token: createShareToken(),
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
      records.set(record.id, record);
      return cloneRecord(record);
    },

    async setEnabledOwned(userId, resumeId, versionId, enabled) {
      const record = owned(userId, resumeId, versionId);
      if (!record) return null;
      record.enabled = enabled;
      record.updatedAt = new Date();
      return cloneRecord(record);
    },

    async regenerateOwned(userId, resumeId, versionId) {
      const record = owned(userId, resumeId, versionId);
      if (!record) return null;
      record.token = createShareToken();
      record.enabled = true;
      record.updatedAt = new Date();
      return cloneRecord(record);
    },

    async findEnabledByToken(token) {
      const record = [...records.values()].find(
        (candidate) => candidate.token === token && candidate.enabled,
      );
      return record ? cloneRecord(record) : null;
    },

    async deleteManyOwnedByVersionIds(userId, resumeId, versionIds) {
      const ids = new Set(versionIds);
      for (const [id, record] of records) {
        if (
          record.userId === userId &&
          record.resumeId === resumeId &&
          ids.has(record.versionId)
        ) {
          records.delete(id);
        }
      }
    },

    async deleteManyOwnedByResumeId(userId, resumeId) {
      for (const [id, record] of records) {
        if (record.userId === userId && record.resumeId === resumeId) {
          records.delete(id);
        }
      }
    },
  };
}

interface MongoResumeShareDocument {
  _id: string;
  userId: string;
  resumeId: string;
  versionId: string;
  token: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toRecord(document: MongoResumeShareDocument): ResumeShareRecord {
  return {
    id: document._id,
    userId: document.userId,
    resumeId: document.resumeId,
    versionId: document.versionId,
    token: document.token,
    enabled: document.enabled,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function createMongoResumeShareRepository(
  database: Db,
): ResumeShareRepository {
  const shares = database.collection<MongoResumeShareDocument>("resume_shares");
  let indexesReady: Promise<unknown> | null = null;
  const ensureIndexes = () =>
    (indexesReady ??= Promise.all([
      shares.createIndex({ token: 1 }, { unique: true }),
      shares.createIndex(
        { userId: 1, resumeId: 1, versionId: 1 },
        { unique: true },
      ),
    ]));

  return {
    async findOwnedForVersion(userId, resumeId, versionId) {
      await ensureIndexes();
      const document = await shares.findOne({ userId, resumeId, versionId });
      return document ? toRecord(document) : null;
    },

    async createOwned(userId, resumeId, versionId) {
      await ensureIndexes();
      const now = new Date();
      let document: MongoResumeShareDocument | null;
      try {
        document = await shares.findOneAndUpdate(
          { userId, resumeId, versionId },
          {
            $set: { enabled: true, updatedAt: now },
            $setOnInsert: {
              _id: createId("share"),
              token: createShareToken(),
              createdAt: now,
            },
          },
          { upsert: true, returnDocument: "after" },
        );
      } catch (error) {
        if (!(error instanceof MongoServerError) || error.code !== 11000) {
          throw error;
        }
        document = await shares.findOne({ userId, resumeId, versionId });
      }
      if (!document) throw new Error("Resume share could not be created.");
      return toRecord(document);
    },

    async setEnabledOwned(userId, resumeId, versionId, enabled) {
      await ensureIndexes();
      const document = await shares.findOneAndUpdate(
        { userId, resumeId, versionId },
        { $set: { enabled, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      return document ? toRecord(document) : null;
    },

    async regenerateOwned(userId, resumeId, versionId) {
      await ensureIndexes();
      const document = await shares.findOneAndUpdate(
        { userId, resumeId, versionId },
        {
          $set: {
            token: createShareToken(),
            enabled: true,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
      return document ? toRecord(document) : null;
    },

    async findEnabledByToken(token) {
      await ensureIndexes();
      const document = await shares.findOne({ token, enabled: true });
      return document ? toRecord(document) : null;
    },

    async deleteManyOwnedByVersionIds(userId, resumeId, versionIds) {
      if (versionIds.length === 0) return;
      await ensureIndexes();
      await shares.deleteMany({
        userId,
        resumeId,
        versionId: { $in: versionIds },
      });
    },

    async deleteManyOwnedByResumeId(userId, resumeId) {
      await ensureIndexes();
      await shares.deleteMany({ userId, resumeId });
    },
  };
}

export function createResumeShareRepositoryRuntime(environment: Environment) {
  if (environment.AUTH_STORAGE !== "mongodb" || !environment.MONGODB_URI) {
    return {
      repository: createMemoryResumeShareRepository(),
      close: async () => undefined,
    };
  }
  const client = new MongoClient(environment.MONGODB_URI);
  return {
    repository: createMongoResumeShareRepository(
      client.db(environment.MONGODB_DATABASE),
    ),
    close: () => client.close(),
  };
}
