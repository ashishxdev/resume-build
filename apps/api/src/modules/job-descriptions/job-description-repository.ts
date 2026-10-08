import type {
  JobDescriptionAnalysis,
  JobDescriptionAnalysisStatus,
  ResumeClaim,
} from "@make-my-resume/contracts";
import { MongoClient, type Db } from "mongodb";

import type { Environment } from "../../config/environment.js";
import { createId } from "../../shared/ids/create-id.js";

export const jobAnalysisLeaseMilliseconds = 2 * 60 * 1_000;
const maximumAnalysisAttempts = 3;

export class JobAnalysisConcurrencyError extends Error {}

export interface JobDescriptionRecord {
  id: string;
  userId: string;
  resumeId: string;
  resumeVersionId: string;
  evidenceClaims: ResumeClaim[];
  role: string | null;
  company: string | null;
  rawText: string;
  status: JobDescriptionAnalysisStatus;
  failureMessage: string | null;
  analysis: JobDescriptionAnalysis | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  analyzedAt: Date | null;
  attempts: number;
  processingToken: string | null;
  processingLeaseExpiresAt: Date | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobDescriptionRepository {
  create(input: {
    userId: string;
    resumeId: string;
    resumeVersionId: string;
    evidenceClaims: ResumeClaim[];
    role?: string;
    company?: string;
    rawText: string;
  }): Promise<JobDescriptionRecord>;
  findOwned(userId: string, id: string): Promise<JobDescriptionRecord | null>;
  deleteManyOwnedByResumeId(userId: string, resumeId: string): Promise<void>;
  claimNext(): Promise<JobDescriptionRecord | null>;
  complete(
    id: string,
    processingToken: string,
    result: {
      analysis: JobDescriptionAnalysis;
      provider: string;
      model: string;
      promptVersion: string;
    },
  ): Promise<JobDescriptionRecord | null>;
  fail(
    id: string,
    processingToken: string,
    message: string,
  ): Promise<JobDescriptionRecord | null>;
  retry(
    userId: string,
    id: string,
    expectedRevision: number,
    evidenceClaims?: ResumeClaim[],
  ): Promise<JobDescriptionRecord | null>;
}

function clone(record: JobDescriptionRecord) {
  return structuredClone(record);
}

function newRecord(
  input: Parameters<JobDescriptionRepository["create"]>[0],
): JobDescriptionRecord {
  const now = new Date();
  return {
    id: createId("jd"),
    userId: input.userId,
    resumeId: input.resumeId,
    resumeVersionId: input.resumeVersionId,
    evidenceClaims: structuredClone(input.evidenceClaims),
    role: input.role?.trim() || null,
    company: input.company?.trim() || null,
    rawText: input.rawText.trim(),
    status: "queued",
    failureMessage: null,
    analysis: null,
    provider: null,
    model: null,
    promptVersion: null,
    analyzedAt: null,
    attempts: 0,
    processingToken: null,
    processingLeaseExpiresAt: null,
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function createMemoryJobDescriptionRepository(): JobDescriptionRepository {
  const records = new Map<string, JobDescriptionRecord>();

  function hasActive(userId: string, exceptId?: string) {
    return [...records.values()].some(
      (record) =>
        record.userId === userId &&
        record.id !== exceptId &&
        ["queued", "analyzing"].includes(record.status),
    );
  }

  return {
    async create(input) {
      if (hasActive(input.userId)) throw new JobAnalysisConcurrencyError();
      const record = newRecord(input);
      records.set(record.id, record);
      return clone(record);
    },
    async findOwned(userId, id) {
      const record = records.get(id);
      return record?.userId === userId ? clone(record) : null;
    },
    async deleteManyOwnedByResumeId(userId, resumeId) {
      for (const [id, record] of records) {
        if (record.userId === userId && record.resumeId === resumeId) {
          records.delete(id);
        }
      }
    },
    async claimNext() {
      const now = new Date();
      for (const record of records.values()) {
        if (
          record.status === "analyzing" &&
          record.processingLeaseExpiresAt &&
          record.processingLeaseExpiresAt <= now &&
          record.attempts >= maximumAnalysisAttempts
        ) {
          record.status = "failed";
          record.failureMessage =
            "Analysis stopped unexpectedly too many times. Please try again.";
          record.processingToken = null;
          record.processingLeaseExpiresAt = null;
          record.revision += 1;
          record.updatedAt = now;
        }
      }
      const record = [...records.values()]
        .filter(
          (candidate) =>
            candidate.attempts < maximumAnalysisAttempts &&
            (candidate.status === "queued" ||
              (candidate.status === "analyzing" &&
                candidate.processingLeaseExpiresAt !== null &&
                candidate.processingLeaseExpiresAt <= now)),
        )
        .sort(
          (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
        )[0];
      if (!record) return null;
      record.status = "analyzing";
      record.attempts += 1;
      record.processingToken = createId("lease");
      record.processingLeaseExpiresAt = new Date(
        now.getTime() + jobAnalysisLeaseMilliseconds,
      );
      record.revision += 1;
      record.updatedAt = now;
      return clone(record);
    },
    async complete(id, processingToken, result) {
      const record = records.get(id);
      if (
        !record ||
        record.status !== "analyzing" ||
        record.processingToken !== processingToken
      )
        return null;
      const now = new Date();
      Object.assign(record, result, {
        status: "completed",
        failureMessage: null,
        analyzedAt: now,
        processingToken: null,
        processingLeaseExpiresAt: null,
        updatedAt: now,
        revision: record.revision + 1,
      });
      return clone(record);
    },
    async fail(id, processingToken, message) {
      const record = records.get(id);
      if (
        !record ||
        record.status !== "analyzing" ||
        record.processingToken !== processingToken
      )
        return null;
      record.status = "failed";
      record.failureMessage = message;
      record.processingToken = null;
      record.processingLeaseExpiresAt = null;
      record.updatedAt = new Date();
      record.revision += 1;
      return clone(record);
    },
    async retry(userId, id, expectedRevision, evidenceClaims) {
      const record = records.get(id);
      if (
        !record ||
        record.userId !== userId ||
        record.status !== "failed" ||
        record.revision !== expectedRevision ||
        hasActive(userId, id)
      )
        return null;
      record.status = "queued";
      record.failureMessage = null;
      record.attempts = 0;
      if (evidenceClaims)
        record.evidenceClaims = structuredClone(evidenceClaims);
      record.updatedAt = new Date();
      record.revision += 1;
      return clone(record);
    },
  };
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11_000
  );
}

export function createMongoJobDescriptionRepository(
  database: Db,
): JobDescriptionRepository {
  const records = database.collection<JobDescriptionRecord>("job_descriptions");
  let indexesReady: Promise<unknown> | null = null;
  const ensureIndexes = () =>
    (indexesReady ??= Promise.all([
      records.createIndex({ id: 1 }, { unique: true }),
      records.createIndex({ userId: 1, createdAt: -1 }),
      records.createIndex({ resumeId: 1, createdAt: -1 }),
      records.createIndex(
        { userId: 1 },
        {
          unique: true,
          name: "one_active_job_analysis_per_user",
          partialFilterExpression: {
            $or: [{ status: "queued" }, { status: "analyzing" }],
          },
        },
      ),
      records.createIndex({
        status: 1,
        processingLeaseExpiresAt: 1,
        createdAt: 1,
      }),
    ]));

  return {
    async create(input) {
      await ensureIndexes();
      const record = newRecord(input);
      try {
        await records.insertOne(record);
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new JobAnalysisConcurrencyError();
        throw error;
      }
      return record;
    },
    async findOwned(userId, id) {
      return records.findOne({ userId, id });
    },
    async deleteManyOwnedByResumeId(userId, resumeId) {
      await records.deleteMany({ userId, resumeId });
    },
    async claimNext() {
      await ensureIndexes();
      const now = new Date();
      const legacyLeaseCutoff = new Date(
        now.getTime() - jobAnalysisLeaseMilliseconds,
      );
      const expiredLease = {
        $or: [
          { processingLeaseExpiresAt: { $lte: now } },
          {
            processingLeaseExpiresAt: null,
            updatedAt: { $lte: legacyLeaseCutoff },
          },
          {
            processingLeaseExpiresAt: { $exists: false },
            updatedAt: { $lte: legacyLeaseCutoff },
          },
        ],
      };
      await records.updateMany(
        {
          status: "analyzing",
          attempts: { $gte: maximumAnalysisAttempts },
          ...expiredLease,
        },
        {
          $set: {
            status: "failed",
            failureMessage:
              "Analysis stopped unexpectedly too many times. Please try again.",
            processingToken: null,
            processingLeaseExpiresAt: null,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
      );
      return records.findOneAndUpdate(
        {
          $and: [
            {
              $or: [
                { attempts: { $lt: maximumAnalysisAttempts } },
                { attempts: { $exists: false } },
              ],
            },
            {
              $or: [
                { status: "queued" },
                { status: "analyzing", ...expiredLease },
              ],
            },
          ],
        },
        {
          $set: {
            status: "analyzing",
            processingToken: createId("lease"),
            processingLeaseExpiresAt: new Date(
              now.getTime() + jobAnalysisLeaseMilliseconds,
            ),
            updatedAt: now,
          },
          $inc: { attempts: 1, revision: 1 },
        },
        { returnDocument: "after", sort: { createdAt: 1 } },
      );
    },
    async complete(id, processingToken, result) {
      const now = new Date();
      return records.findOneAndUpdate(
        { id, status: "analyzing", processingToken },
        {
          $set: {
            ...result,
            status: "completed",
            failureMessage: null,
            analyzedAt: now,
            processingToken: null,
            processingLeaseExpiresAt: null,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
    },
    async fail(id, processingToken, message) {
      return records.findOneAndUpdate(
        { id, status: "analyzing", processingToken },
        {
          $set: {
            status: "failed",
            failureMessage: message,
            processingToken: null,
            processingLeaseExpiresAt: null,
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
    },
    async retry(userId, id, expectedRevision, evidenceClaims) {
      try {
        return await records.findOneAndUpdate(
          { userId, id, status: "failed", revision: expectedRevision },
          {
            $set: {
              status: "queued",
              failureMessage: null,
              attempts: 0,
              ...(evidenceClaims ? { evidenceClaims } : {}),
              updatedAt: new Date(),
            },
            $inc: { revision: 1 },
          },
          { returnDocument: "after" },
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new JobAnalysisConcurrencyError();
        throw error;
      }
    },
  };
}

export function createJobDescriptionRepositoryRuntime(
  environment: Environment,
) {
  if (environment.AUTH_STORAGE !== "mongodb" || !environment.MONGODB_URI) {
    return {
      repository: createMemoryJobDescriptionRepository(),
      close: async () => {},
    };
  }
  const client = new MongoClient(environment.MONGODB_URI);
  return {
    repository: createMongoJobDescriptionRepository(
      client.db(environment.MONGODB_DATABASE),
    ),
    close: async () => client.close(),
  };
}
