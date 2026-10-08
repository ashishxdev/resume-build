import type {
  ResumeClaim,
  ResumeExtractionStatus,
} from "@make-my-resume/contracts";
import { MongoClient, type Db, type Filter } from "mongodb";

import type { Environment } from "../../config/environment.js";
import { createId } from "../../shared/ids/create-id.js";

export interface ResumeExtractionRecord {
  id: string;
  userId: string;
  resumeId: string;
  importId: string;
  objectKey: string;
  mimeType:
    | "application/pdf"
    | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  status: ResumeExtractionStatus;
  progress: number;
  failureMessage: string | null;
  attempts: number;
  processingLeaseExpiresAt: Date | null;
  processingToken: string | null;
  revision: number;
  versionId: string | null;
  claims: ResumeClaim[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeExtractionRepository {
  createQueued(
    input: Omit<
      ResumeExtractionRecord,
      | "id"
      | "status"
      | "progress"
      | "failureMessage"
      | "attempts"
      | "processingLeaseExpiresAt"
      | "processingToken"
      | "revision"
      | "versionId"
      | "claims"
      | "createdAt"
      | "updatedAt"
    >,
  ): Promise<ResumeExtractionRecord>;
  findOwned(
    userId: string,
    resumeId: string,
  ): Promise<ResumeExtractionRecord | null>;
  findManyOwned(
    userId: string,
    resumeIds: string[],
  ): Promise<ResumeExtractionRecord[]>;
  deleteOwned(userId: string, resumeId: string): Promise<void>;
  claimNext(): Promise<ResumeExtractionRecord | null>;
  complete(
    jobId: string,
    processingToken: string,
    claims: ResumeClaim[],
  ): Promise<ResumeExtractionRecord | null>;
  fail(
    jobId: string,
    processingToken: string,
    message: string,
  ): Promise<ResumeExtractionRecord | null>;
  retry(
    userId: string,
    resumeId: string,
  ): Promise<ResumeExtractionRecord | null>;
  updateClaims(
    userId: string,
    resumeId: string,
    claims: ResumeClaim[],
    expectedRevision: number,
  ): Promise<ResumeExtractionRecord | null>;
}

export const extractionProcessingLeaseMilliseconds = 10 * 60 * 1_000;
const maximumExtractionAttempts = 3;

function clone(record: ResumeExtractionRecord) {
  return structuredClone(record);
}

export function createMemoryResumeExtractionRepository(): ResumeExtractionRepository {
  const records = new Map<string, ResumeExtractionRecord>();

  return {
    async createQueued(input) {
      const existing = [...records.values()].find(
        (record) => record.resumeId === input.resumeId,
      );
      if (existing) return clone(existing);
      const now = new Date();
      const record: ResumeExtractionRecord = {
        ...input,
        id: createId("job"),
        status: "queued",
        progress: 0,
        failureMessage: null,
        attempts: 0,
        processingLeaseExpiresAt: null,
        processingToken: null,
        revision: 0,
        versionId: null,
        claims: [],
        createdAt: now,
        updatedAt: now,
      };
      records.set(record.id, record);
      return clone(record);
    },

    async findOwned(userId, resumeId) {
      const record = [...records.values()].find(
        (candidate) =>
          candidate.userId === userId && candidate.resumeId === resumeId,
      );
      return record ? clone(record) : null;
    },

    async findManyOwned(userId, resumeIds) {
      const ids = new Set(resumeIds);
      return [...records.values()]
        .filter(
          (record) => record.userId === userId && ids.has(record.resumeId),
        )
        .map(clone);
    },

    async deleteOwned(userId, resumeId) {
      for (const [id, record] of records) {
        if (record.userId === userId && record.resumeId === resumeId) {
          records.delete(id);
        }
      }
    },

    async claimNext() {
      const now = new Date();
      const legacyLeaseCutoff = new Date(
        now.getTime() - extractionProcessingLeaseMilliseconds,
      );
      for (const candidate of records.values()) {
        const leaseExpired =
          candidate.status === "processing" &&
          (candidate.processingLeaseExpiresAt
            ? candidate.processingLeaseExpiresAt <= now
            : candidate.updatedAt <= legacyLeaseCutoff);
        if (leaseExpired && candidate.attempts >= maximumExtractionAttempts) {
          candidate.status = "failed";
          candidate.progress = 0;
          candidate.failureMessage =
            "Extraction stopped unexpectedly too many times. Please retry the upload.";
          candidate.processingLeaseExpiresAt = null;
          candidate.processingToken = null;
          candidate.revision += 1;
          candidate.updatedAt = now;
        }
      }
      const record = [...records.values()]
        .filter((candidate) => {
          if (candidate.attempts >= maximumExtractionAttempts) return false;
          if (candidate.status === "queued") return true;
          if (candidate.status !== "processing") return false;
          return candidate.processingLeaseExpiresAt
            ? candidate.processingLeaseExpiresAt <= now
            : candidate.updatedAt <= legacyLeaseCutoff;
        })
        .sort(
          (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
        )[0];
      if (!record) return null;
      record.status = "processing";
      record.progress = 20;
      record.attempts += 1;
      record.processingToken = createId("lease");
      record.processingLeaseExpiresAt = new Date(
        now.getTime() + extractionProcessingLeaseMilliseconds,
      );
      record.revision += 1;
      record.updatedAt = now;
      return clone(record);
    },

    async complete(jobId, processingToken, claims) {
      const record = records.get(jobId);
      if (
        !record ||
        record.status !== "processing" ||
        record.processingToken !== processingToken
      )
        return null;
      record.status = "review_required";
      record.progress = 100;
      record.claims = structuredClone(claims);
      record.failureMessage = null;
      record.processingLeaseExpiresAt = null;
      record.processingToken = null;
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },

    async fail(jobId, processingToken, message) {
      const record = records.get(jobId);
      if (
        !record ||
        record.status !== "processing" ||
        record.processingToken !== processingToken
      )
        return null;
      record.status = "failed";
      record.progress = 0;
      record.failureMessage = message;
      record.processingLeaseExpiresAt = null;
      record.processingToken = null;
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },

    async retry(userId, resumeId) {
      const record = [...records.values()].find(
        (candidate) =>
          candidate.userId === userId &&
          candidate.resumeId === resumeId &&
          candidate.status === "failed" &&
          candidate.attempts < 3,
      );
      if (!record) return null;
      record.status = "queued";
      record.progress = 0;
      record.failureMessage = null;
      record.processingLeaseExpiresAt = null;
      record.processingToken = null;
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },

    async updateClaims(userId, resumeId, claims, expectedRevision) {
      const record = [...records.values()].find(
        (candidate) =>
          candidate.userId === userId &&
          candidate.resumeId === resumeId &&
          candidate.revision === expectedRevision &&
          ["review_required", "verified"].includes(candidate.status),
      );
      if (!record) return null;
      const claimsChanged =
        JSON.stringify(record.claims) !== JSON.stringify(claims);
      record.claims = structuredClone(claims);
      const verified =
        claims.length > 0 &&
        claims.every((claim) => claim.status !== "unreviewed");
      record.status = verified ? "verified" : "review_required";
      record.versionId = verified
        ? record.versionId && !claimsChanged
          ? record.versionId
          : createId("version")
        : null;
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },
  };
}

class ResumeExtractionStateConflict extends Error {}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11_000
  );
}

function revisionFilter(
  record: Pick<ResumeExtractionRecord, "id" | "revision" | "status">,
): Filter<ResumeExtractionRecord> {
  const revision = record.revision ?? 0;
  return {
    id: record.id,
    status: record.status,
    ...(revision === 0
      ? { $or: [{ revision: 0 }, { revision: { $exists: false } }] }
      : { revision }),
  };
}

export function createMongoResumeExtractionRepository(
  client: MongoClient,
  database: Db,
): ResumeExtractionRepository {
  const jobs =
    database.collection<ResumeExtractionRecord>("resume_extractions");
  const versions = database.collection<{ _id: string }>("resume_versions");
  const resumes = database.collection<{
    _id: string;
    userId: string;
    isDeleted: boolean;
  }>("resumes");
  let indexesReady: Promise<unknown> | null = null;

  function ensureIndexes() {
    indexesReady ??= Promise.all([
      jobs.createIndex({ resumeId: 1 }, { unique: true }),
      jobs.createIndex({
        status: 1,
        processingLeaseExpiresAt: 1,
        createdAt: 1,
      }),
    ]);
    return indexesReady;
  }

  return {
    async createQueued(input) {
      await ensureIndexes();
      const now = new Date();
      const record: ResumeExtractionRecord = {
        ...input,
        id: createId("job"),
        status: "queued",
        progress: 0,
        failureMessage: null,
        attempts: 0,
        processingLeaseExpiresAt: null,
        processingToken: null,
        revision: 0,
        versionId: null,
        claims: [],
        createdAt: now,
        updatedAt: now,
      };
      let created: ResumeExtractionRecord | null;
      try {
        created = await jobs.findOneAndUpdate(
          { resumeId: input.resumeId },
          { $setOnInsert: record },
          { upsert: true, returnDocument: "after" },
        );
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        created = await jobs.findOne({ resumeId: input.resumeId });
      }
      if (!created) throw new Error("Extraction job could not be created.");
      return created;
    },

    async findOwned(userId, resumeId) {
      return jobs.findOne({ userId, resumeId });
    },

    async findManyOwned(userId, resumeIds) {
      if (resumeIds.length === 0) return [];
      return jobs.find({ userId, resumeId: { $in: resumeIds } }).toArray();
    },

    async deleteOwned(userId, resumeId) {
      await jobs.deleteMany({ userId, resumeId });
    },

    async claimNext() {
      const now = new Date();
      const legacyLeaseCutoff = new Date(
        now.getTime() - extractionProcessingLeaseMilliseconds,
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
      await jobs.updateMany(
        {
          status: "processing",
          attempts: { $gte: maximumExtractionAttempts },
          ...expiredLease,
        },
        {
          $set: {
            status: "failed",
            progress: 0,
            failureMessage:
              "Extraction stopped unexpectedly too many times. Please retry the upload.",
            processingLeaseExpiresAt: null,
            processingToken: null,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
      );
      return jobs.findOneAndUpdate(
        {
          attempts: { $lt: maximumExtractionAttempts },
          $or: [
            { status: "queued" },
            { status: "processing", ...expiredLease },
          ],
        },
        {
          $set: {
            status: "processing",
            progress: 20,
            processingLeaseExpiresAt: new Date(
              now.getTime() + extractionProcessingLeaseMilliseconds,
            ),
            processingToken: createId("lease"),
            updatedAt: now,
          },
          $inc: { attempts: 1, revision: 1 },
        },
        { returnDocument: "after", sort: { createdAt: 1 } },
      );
    },

    async complete(jobId, processingToken, claims) {
      return jobs.findOneAndUpdate(
        { id: jobId, status: "processing", processingToken },
        {
          $set: {
            status: "review_required",
            progress: 100,
            claims,
            failureMessage: null,
            processingLeaseExpiresAt: null,
            processingToken: null,
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
    },

    async fail(jobId, processingToken, message) {
      return jobs.findOneAndUpdate(
        { id: jobId, status: "processing", processingToken },
        {
          $set: {
            status: "failed",
            progress: 0,
            failureMessage: message,
            processingLeaseExpiresAt: null,
            processingToken: null,
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
    },

    async retry(userId, resumeId) {
      return jobs.findOneAndUpdate(
        { userId, resumeId, status: "failed", attempts: { $lt: 3 } },
        {
          $set: {
            status: "queued",
            progress: 0,
            failureMessage: null,
            processingLeaseExpiresAt: null,
            processingToken: null,
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
    },

    async updateClaims(userId, resumeId, claims, expectedRevision) {
      const session = client.startSession();
      let result: ResumeExtractionRecord | null = null;
      try {
        await session.withTransaction(async () => {
          const existing = await jobs.findOne(
            { userId, resumeId },
            { session },
          );
          if (
            !existing ||
            !["review_required", "verified"].includes(existing.status) ||
            (existing.revision ?? 0) !== expectedRevision
          ) {
            throw new ResumeExtractionStateConflict();
          }

          const verified =
            claims.length > 0 &&
            claims.every((claim) => claim.status !== "unreviewed");
          const claimsChanged =
            JSON.stringify(existing.claims) !== JSON.stringify(claims);
          const versionId = verified
            ? existing.versionId && !claimsChanged
              ? existing.versionId
              : createId("version")
            : null;
          const now = new Date();
          const updated = await jobs.findOneAndUpdate(
            {
              ...revisionFilter(existing),
              userId,
              resumeId,
            },
            {
              $set: {
                claims,
                status: verified ? "verified" : "review_required",
                versionId,
                updatedAt: now,
              },
              $inc: { revision: 1 },
            },
            { returnDocument: "after", session },
          );
          if (!updated) throw new ResumeExtractionStateConflict();

          if (verified && versionId) {
            await versions.updateOne(
              { _id: versionId },
              {
                $set: {
                  resumeId,
                  userId,
                  type: "base",
                  schemaVersion: 1,
                  content: { claims },
                  verificationStatus: "verified",
                  updatedAt: now,
                },
                $setOnInsert: { createdAt: now },
              },
              { upsert: true, session },
            );
            const resumeUpdate = await resumes.updateOne(
              { _id: resumeId, userId, isDeleted: false },
              { $set: { baseVersionId: versionId, updatedAt: now } },
              { session },
            );
            if (resumeUpdate.matchedCount !== 1) {
              throw new ResumeExtractionStateConflict();
            }
          } else {
            const resumeUpdate = await resumes.updateOne(
              { _id: resumeId, userId, isDeleted: false },
              { $unset: { baseVersionId: "" }, $set: { updatedAt: now } },
              { session },
            );
            if (resumeUpdate.matchedCount !== 1) {
              throw new ResumeExtractionStateConflict();
            }
          }
          result = updated;
        });
        return result;
      } catch (error) {
        if (error instanceof ResumeExtractionStateConflict) return null;
        throw error;
      } finally {
        await session.endSession();
      }
    },
  };
}

export function createResumeExtractionRepositoryRuntime(
  environment: Environment,
) {
  if (environment.AUTH_STORAGE !== "mongodb" || !environment.MONGODB_URI) {
    return {
      repository: createMemoryResumeExtractionRepository(),
      close: async () => {},
    };
  }
  const client = new MongoClient(environment.MONGODB_URI);
  return {
    repository: createMongoResumeExtractionRepository(
      client,
      client.db(environment.MONGODB_DATABASE),
    ),
    close: async () => client.close(),
  };
}
