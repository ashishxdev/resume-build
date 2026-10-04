import type {
  AtsAnalysisSnapshot,
  AtsAnalysisStatus,
  JobDescriptionAnalysis,
  ResumeClaim,
  TailoringSessionStatus,
  TailoringSuggestion,
} from "@make-my-resume/contracts";
import { MongoClient, type Db } from "mongodb";

import type { Environment } from "../../config/environment.js";
import { createId } from "../../shared/ids/create-id.js";

export const tailoringLeaseMilliseconds = 2 * 60 * 1_000;
const maximumAttempts = 3;

export class TailoringConcurrencyError extends Error {}
class TailoringStateConflict extends Error {}

export interface TailoringSessionRecord {
  id: string;
  userId: string;
  jobDescriptionId: string;
  resumeId: string;
  resumeVersionId: string;
  role: string | null;
  company: string | null;
  rawJobDescription: string;
  analysis: JobDescriptionAnalysis;
  evidenceClaims: ResumeClaim[];
  status: TailoringSessionStatus;
  failureMessage: string | null;
  suggestions: TailoringSuggestion[];
  finalClaims: ResumeClaim[] | null;
  tailoredVersionId: string | null;
  provider: string | null;
  model: string | null;
  promptVersion: string | null;
  attempts: number;
  processingToken: string | null;
  processingLeaseExpiresAt: Date | null;
  revision: number;
  atsStatus: AtsAnalysisStatus;
  atsFailureMessage: string | null;
  atsSnapshot: AtsAnalysisSnapshot | null;
  atsAttempts: number;
  atsProcessingToken: string | null;
  atsLeaseExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TailoringRepository {
  create(input: {
    userId: string;
    jobDescriptionId: string;
    resumeId: string;
    resumeVersionId: string;
    role: string | null;
    company: string | null;
    rawJobDescription: string;
    analysis: JobDescriptionAnalysis;
    evidenceClaims: ResumeClaim[];
  }): Promise<TailoringSessionRecord>;
  findOwned(userId: string, id: string): Promise<TailoringSessionRecord | null>;
  findOwnedByJobDescription(
    userId: string,
    jobDescriptionId: string,
  ): Promise<TailoringSessionRecord | null>;
  findManyOwned(userId: string): Promise<TailoringSessionRecord[]>;
  claimNext(): Promise<TailoringSessionRecord | null>;
  generated(
    id: string,
    processingToken: string,
    output: {
      suggestions: TailoringSuggestion[];
      provider: string;
      model: string;
      promptVersion: string;
    },
  ): Promise<TailoringSessionRecord | null>;
  fail(
    id: string,
    processingToken: string,
    message: string,
  ): Promise<TailoringSessionRecord | null>;
  retry(
    userId: string,
    id: string,
    expectedRevision: number,
  ): Promise<TailoringSessionRecord | null>;
  decide(
    userId: string,
    id: string,
    suggestionId: string,
    expectedRevision: number,
    decision: {
      status: "accepted" | "rejected";
      editedText?: string | null;
    },
  ): Promise<TailoringSessionRecord | null>;
  decideAll(
    userId: string,
    id: string,
    expectedRevision: number,
    status: "accepted" | "rejected",
  ): Promise<TailoringSessionRecord | null>;
  complete(
    userId: string,
    id: string,
    expectedRevision: number,
  ): Promise<TailoringSessionRecord | null>;
  queueAts(userId: string, id: string): Promise<TailoringSessionRecord | null>;
  claimNextAts(): Promise<TailoringSessionRecord | null>;
  completeAts(
    id: string,
    processingToken: string,
    snapshot: AtsAnalysisSnapshot,
  ): Promise<TailoringSessionRecord | null>;
  failAts(
    id: string,
    processingToken: string,
    message: string,
  ): Promise<TailoringSessionRecord | null>;
  retryAts(userId: string, id: string): Promise<TailoringSessionRecord | null>;
}

function clone(record: TailoringSessionRecord) {
  return structuredClone(record);
}

function buildFinalClaims(record: TailoringSessionRecord) {
  const decisions = new Map(
    record.suggestions.map((suggestion) => [
      suggestion.sourceClaimId,
      suggestion,
    ]),
  );
  return record.evidenceClaims.map((claim) => {
    const suggestion = decisions.get(claim.id);
    if (!suggestion || suggestion.status !== "accepted")
      return cloneClaim(claim);
    return {
      ...cloneClaim(claim),
      value: suggestion.editedText ?? suggestion.suggestedText,
      status: "edited" as const,
    };
  });
}

function cloneClaim(claim: ResumeClaim) {
  return structuredClone(claim);
}

function newRecord(
  input: Parameters<TailoringRepository["create"]>[0],
): TailoringSessionRecord {
  const now = new Date();
  return {
    ...input,
    id: createId("tailor"),
    status: "queued",
    failureMessage: null,
    suggestions: [],
    finalClaims: null,
    tailoredVersionId: null,
    provider: null,
    model: null,
    promptVersion: null,
    attempts: 0,
    processingToken: null,
    processingLeaseExpiresAt: null,
    revision: 0,
    atsStatus: "not_started",
    atsFailureMessage: null,
    atsSnapshot: null,
    atsAttempts: 0,
    atsProcessingToken: null,
    atsLeaseExpiresAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createMemoryTailoringRepository(): TailoringRepository {
  const records = new Map<string, TailoringSessionRecord>();
  return {
    async create(input) {
      const existing = [...records.values()].find(
        (record) =>
          record.userId === input.userId &&
          record.jobDescriptionId === input.jobDescriptionId,
      );
      if (existing) return clone(existing);
      if (
        [...records.values()].some(
          (record) =>
            record.userId === input.userId &&
            ["queued", "generating"].includes(record.status),
        )
      ) {
        throw new TailoringConcurrencyError();
      }
      const record = newRecord(input);
      records.set(record.id, record);
      return clone(record);
    },
    async findOwned(userId, id) {
      const record = records.get(id);
      return record?.userId === userId ? clone(record) : null;
    },
    async findOwnedByJobDescription(userId, jobDescriptionId) {
      const record = [...records.values()].find(
        (candidate) =>
          candidate.userId === userId &&
          candidate.jobDescriptionId === jobDescriptionId,
      );
      return record ? clone(record) : null;
    },
    async findManyOwned(userId) {
      return [...records.values()]
        .filter((record) => record.userId === userId)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
        .map(clone);
    },
    async claimNext() {
      const now = new Date();
      for (const record of records.values()) {
        if (
          record.status === "generating" &&
          record.processingLeaseExpiresAt &&
          record.processingLeaseExpiresAt <= now &&
          record.attempts >= maximumAttempts
        ) {
          record.status = "failed";
          record.failureMessage =
            "Suggestion generation stopped unexpectedly too many times. Please try again.";
          record.processingToken = null;
          record.processingLeaseExpiresAt = null;
          record.revision += 1;
          record.updatedAt = now;
        }
      }
      const record = [...records.values()]
        .filter(
          (candidate) =>
            candidate.attempts < maximumAttempts &&
            (candidate.status === "queued" ||
              (candidate.status === "generating" &&
                candidate.processingLeaseExpiresAt !== null &&
                candidate.processingLeaseExpiresAt <= now)),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (!record) return null;
      record.status = "generating";
      record.attempts += 1;
      record.processingToken = createId("lease");
      record.processingLeaseExpiresAt = new Date(
        now.getTime() + tailoringLeaseMilliseconds,
      );
      record.revision += 1;
      record.updatedAt = now;
      return clone(record);
    },
    async generated(id, token, output) {
      const record = records.get(id);
      if (
        !record ||
        record.status !== "generating" ||
        record.processingToken !== token
      )
        return null;
      Object.assign(
        record,
        { ...output, suggestions: structuredClone(output.suggestions) },
        {
          status: "review",
          failureMessage: null,
          processingToken: null,
          processingLeaseExpiresAt: null,
          revision: record.revision + 1,
          updatedAt: new Date(),
        },
      );
      return clone(record);
    },
    async fail(id, token, message) {
      const record = records.get(id);
      if (
        !record ||
        record.status !== "generating" ||
        record.processingToken !== token
      )
        return null;
      Object.assign(record, {
        status: "failed",
        failureMessage: message,
        processingToken: null,
        processingLeaseExpiresAt: null,
        revision: record.revision + 1,
        updatedAt: new Date(),
      });
      return clone(record);
    },
    async retry(userId, id, revision) {
      const record = records.get(id);
      if (
        !record ||
        record.userId !== userId ||
        record.status !== "failed" ||
        record.revision !== revision ||
        [...records.values()].some(
          (candidate) =>
            candidate.userId === userId &&
            candidate.id !== id &&
            ["queued", "generating"].includes(candidate.status),
        )
      )
        return null;
      record.status = "queued";
      record.failureMessage = null;
      record.attempts = 0;
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },
    async decide(userId, id, suggestionId, revision, decision) {
      const record = records.get(id);
      const suggestion = record?.suggestions.find(
        (candidate) => candidate.id === suggestionId,
      );
      if (
        !record ||
        !suggestion ||
        record.userId !== userId ||
        record.status !== "review" ||
        record.revision !== revision
      )
        return null;
      suggestion.status = decision.status;
      suggestion.editedText =
        decision.status === "accepted" ? (decision.editedText ?? null) : null;
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },
    async decideAll(userId, id, revision, status) {
      const record = records.get(id);
      if (
        !record ||
        record.userId !== userId ||
        record.status !== "review" ||
        record.revision !== revision
      )
        return null;
      for (const suggestion of record.suggestions) {
        suggestion.status = status;
        if (status === "rejected") suggestion.editedText = null;
      }
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },
    async complete(userId, id, revision) {
      const record = records.get(id);
      if (
        !record ||
        record.userId !== userId ||
        record.status !== "review" ||
        record.revision !== revision ||
        record.suggestions.some((suggestion) => suggestion.status === "pending")
      )
        return null;
      record.finalClaims = buildFinalClaims(record);
      record.tailoredVersionId = createId("version");
      record.status = "completed";
      record.revision += 1;
      record.updatedAt = new Date();
      return clone(record);
    },
    async queueAts(userId, id) {
      const record = records.get(id);
      if (!record || record.userId !== userId || record.status !== "completed")
        return null;
      if (record.atsStatus !== "not_started") return clone(record);
      record.atsStatus = "queued";
      record.atsFailureMessage = null;
      record.updatedAt = new Date();
      return clone(record);
    },
    async claimNextAts() {
      const now = new Date();
      for (const record of records.values()) {
        if (
          record.atsStatus === "analyzing" &&
          record.atsLeaseExpiresAt &&
          record.atsLeaseExpiresAt <= now &&
          record.atsAttempts >= maximumAttempts
        ) {
          record.atsStatus = "failed";
          record.atsFailureMessage =
            "ATS analysis stopped unexpectedly. Please try again.";
          record.atsProcessingToken = null;
          record.atsLeaseExpiresAt = null;
        }
      }
      const record = [...records.values()].find(
        (candidate) =>
          candidate.atsAttempts < maximumAttempts &&
          (candidate.atsStatus === "queued" ||
            (candidate.atsStatus === "analyzing" &&
              candidate.atsLeaseExpiresAt !== null &&
              candidate.atsLeaseExpiresAt <= now)),
      );
      if (!record) return null;
      record.atsStatus = "analyzing";
      record.atsAttempts += 1;
      record.atsProcessingToken = createId("lease");
      record.atsLeaseExpiresAt = new Date(
        now.getTime() + tailoringLeaseMilliseconds,
      );
      record.updatedAt = now;
      return clone(record);
    },
    async completeAts(id, token, snapshot) {
      const record = records.get(id);
      if (
        !record ||
        record.atsStatus !== "analyzing" ||
        record.atsProcessingToken !== token
      )
        return null;
      record.atsStatus = "completed";
      record.atsSnapshot = structuredClone(snapshot);
      record.atsFailureMessage = null;
      record.atsProcessingToken = null;
      record.atsLeaseExpiresAt = null;
      record.updatedAt = new Date();
      return clone(record);
    },
    async failAts(id, token, message) {
      const record = records.get(id);
      if (
        !record ||
        record.atsStatus !== "analyzing" ||
        record.atsProcessingToken !== token
      )
        return null;
      record.atsStatus = "failed";
      record.atsFailureMessage = message;
      record.atsProcessingToken = null;
      record.atsLeaseExpiresAt = null;
      record.updatedAt = new Date();
      return clone(record);
    },
    async retryAts(userId, id) {
      const record = records.get(id);
      if (!record || record.userId !== userId || record.atsStatus !== "failed")
        return null;
      record.atsStatus = "queued";
      record.atsFailureMessage = null;
      record.atsAttempts = 0;
      record.updatedAt = new Date();
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

export function createMongoTailoringRepository(
  client: MongoClient,
  database: Db,
): TailoringRepository {
  const records =
    database.collection<TailoringSessionRecord>("tailoring_sessions");
  const versions = database.collection<
    { _id: string } & Record<string, unknown>
  >("resume_versions");
  let indexesReady: Promise<unknown> | null = null;
  const ensureIndexes = () =>
    (indexesReady ??= Promise.all([
      records.createIndex({ id: 1 }, { unique: true }),
      records.createIndex({ userId: 1, jobDescriptionId: 1 }, { unique: true }),
      records.createIndex(
        { userId: 1 },
        {
          unique: true,
          name: "one_active_tailoring_session_per_user",
          partialFilterExpression: {
            $or: [{ status: "queued" }, { status: "generating" }],
          },
        },
      ),
      records.createIndex({
        status: 1,
        processingLeaseExpiresAt: 1,
        createdAt: 1,
      }),
      records.createIndex({ atsStatus: 1, atsLeaseExpiresAt: 1, updatedAt: 1 }),
    ]));
  return {
    async create(input) {
      await ensureIndexes();
      const existing = await records.findOne({
        userId: input.userId,
        jobDescriptionId: input.jobDescriptionId,
      });
      if (existing) return existing;
      const record = newRecord(input);
      try {
        await records.insertOne(record);
        return record;
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        const concurrent = await records.findOne({
          userId: input.userId,
          jobDescriptionId: input.jobDescriptionId,
        });
        if (concurrent) return concurrent;
        throw new TailoringConcurrencyError();
      }
    },
    async findOwned(userId, id) {
      return records.findOne({ userId, id });
    },
    async findOwnedByJobDescription(userId, jobDescriptionId) {
      return records.findOne({ userId, jobDescriptionId });
    },
    async findManyOwned(userId) {
      return records.find({ userId }).sort({ updatedAt: -1 }).toArray();
    },
    async claimNext() {
      await ensureIndexes();
      const now = new Date();
      const expired = { processingLeaseExpiresAt: { $lte: now } };
      await records.updateMany(
        {
          status: "generating",
          attempts: { $gte: maximumAttempts },
          ...expired,
        },
        {
          $set: {
            status: "failed",
            failureMessage:
              "Suggestion generation stopped unexpectedly too many times. Please try again.",
            processingToken: null,
            processingLeaseExpiresAt: null,
            updatedAt: now,
          },
          $inc: { revision: 1 },
        },
      );
      return records.findOneAndUpdate(
        {
          attempts: { $lt: maximumAttempts },
          $or: [{ status: "queued" }, { status: "generating", ...expired }],
        },
        {
          $set: {
            status: "generating",
            processingToken: createId("lease"),
            processingLeaseExpiresAt: new Date(
              now.getTime() + tailoringLeaseMilliseconds,
            ),
            updatedAt: now,
          },
          $inc: { attempts: 1, revision: 1 },
        },
        { returnDocument: "after", sort: { createdAt: 1 } },
      );
    },
    async generated(id, token, output) {
      return records.findOneAndUpdate(
        { id, status: "generating", processingToken: token },
        {
          $set: {
            ...output,
            status: "review",
            failureMessage: null,
            processingToken: null,
            processingLeaseExpiresAt: null,
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
    },
    async fail(id, token, message) {
      return records.findOneAndUpdate(
        { id, status: "generating", processingToken: token },
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
    async retry(userId, id, revision) {
      try {
        return await records.findOneAndUpdate(
          { userId, id, status: "failed", revision },
          {
            $set: {
              status: "queued",
              failureMessage: null,
              attempts: 0,
              updatedAt: new Date(),
            },
            $inc: { revision: 1 },
          },
          { returnDocument: "after" },
        );
      } catch (error) {
        if (isDuplicateKeyError(error)) throw new TailoringConcurrencyError();
        throw error;
      }
    },
    async decide(userId, id, suggestionId, revision, decision) {
      const set: Record<string, unknown> = {
        "suggestions.$.status": decision.status,
        "suggestions.$.editedText":
          decision.status === "accepted" ? (decision.editedText ?? null) : null,
        updatedAt: new Date(),
      };
      return records.findOneAndUpdate(
        {
          userId,
          id,
          status: "review",
          revision,
          "suggestions.id": suggestionId,
        },
        { $set: set, $inc: { revision: 1 } },
        { returnDocument: "after" },
      );
    },
    async decideAll(userId, id, revision, status) {
      return records.findOneAndUpdate(
        { userId, id, status: "review", revision },
        {
          $set: {
            "suggestions.$[].status": status,
            ...(status === "rejected"
              ? { "suggestions.$[].editedText": null }
              : {}),
            updatedAt: new Date(),
          },
          $inc: { revision: 1 },
        },
        { returnDocument: "after" },
      );
    },
    async complete(userId, id, revision) {
      const session = client.startSession();
      let result: TailoringSessionRecord | null = null;
      try {
        await session.withTransaction(async () => {
          const current = await records.findOne(
            { userId, id, status: "review", revision },
            { session },
          );
          if (
            !current ||
            current.suggestions.some(
              (suggestion) => suggestion.status === "pending",
            )
          )
            return;
          const finalClaims = buildFinalClaims(current);
          const tailoredVersionId = createId("version");
          const now = new Date();
          await versions.insertOne(
            {
              _id: tailoredVersionId,
              resumeId: current.resumeId,
              userId,
              type: "tailored",
              baseVersionId: current.resumeVersionId,
              jobDescriptionId: current.jobDescriptionId,
              tailoringSessionId: current.id,
              schemaVersion: 1,
              content: { claims: finalClaims },
              verificationStatus: "verified",
              createdAt: now,
              updatedAt: now,
            },
            { session },
          );
          result = await records.findOneAndUpdate(
            { userId, id, status: "review", revision },
            {
              $set: {
                status: "completed",
                finalClaims,
                tailoredVersionId,
                updatedAt: now,
              },
              $inc: { revision: 1 },
            },
            { returnDocument: "after", session },
          );
          if (!result) throw new TailoringStateConflict();
        });
        return result;
      } catch (error) {
        if (error instanceof TailoringStateConflict) return null;
        throw error;
      } finally {
        await session.endSession();
      }
    },
    async queueAts(userId, id) {
      const current = await records.findOne({
        userId,
        id,
        status: "completed",
      });
      if (!current) return null;
      if ((current.atsStatus ?? "not_started") !== "not_started")
        return current;
      return records.findOneAndUpdate(
        {
          userId,
          id,
          status: "completed",
          $or: [
            { atsStatus: "not_started" },
            { atsStatus: { $exists: false } },
          ],
        },
        {
          $set: {
            atsStatus: "queued",
            atsFailureMessage: null,
            atsAttempts: 0,
            atsSnapshot: null,
            atsProcessingToken: null,
            atsLeaseExpiresAt: null,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
    },
    async claimNextAts() {
      await ensureIndexes();
      const now = new Date();
      const expired = { atsLeaseExpiresAt: { $lte: now } };
      await records.updateMany(
        {
          atsStatus: "analyzing",
          atsAttempts: { $gte: maximumAttempts },
          ...expired,
        },
        {
          $set: {
            atsStatus: "failed",
            atsFailureMessage:
              "ATS analysis stopped unexpectedly. Please try again.",
            atsProcessingToken: null,
            atsLeaseExpiresAt: null,
            updatedAt: now,
          },
        },
      );
      return records.findOneAndUpdate(
        {
          atsAttempts: { $lt: maximumAttempts },
          $or: [
            { atsStatus: "queued" },
            { atsStatus: "analyzing", ...expired },
          ],
        },
        {
          $set: {
            atsStatus: "analyzing",
            atsProcessingToken: createId("lease"),
            atsLeaseExpiresAt: new Date(
              now.getTime() + tailoringLeaseMilliseconds,
            ),
            updatedAt: now,
          },
          $inc: { atsAttempts: 1 },
        },
        { returnDocument: "after", sort: { updatedAt: 1 } },
      );
    },
    async completeAts(id, token, snapshot) {
      return records.findOneAndUpdate(
        { id, atsStatus: "analyzing", atsProcessingToken: token },
        {
          $set: {
            atsStatus: "completed",
            atsSnapshot: snapshot,
            atsFailureMessage: null,
            atsProcessingToken: null,
            atsLeaseExpiresAt: null,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
    },
    async failAts(id, token, message) {
      return records.findOneAndUpdate(
        { id, atsStatus: "analyzing", atsProcessingToken: token },
        {
          $set: {
            atsStatus: "failed",
            atsFailureMessage: message,
            atsProcessingToken: null,
            atsLeaseExpiresAt: null,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
    },
    async retryAts(userId, id) {
      return records.findOneAndUpdate(
        { userId, id, atsStatus: "failed", status: "completed" },
        {
          $set: {
            atsStatus: "queued",
            atsFailureMessage: null,
            atsAttempts: 0,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
    },
  };
}

export function createTailoringRepositoryRuntime(environment: Environment) {
  if (environment.AUTH_STORAGE === "memory") {
    return {
      repository: createMemoryTailoringRepository(),
      close: async () => undefined,
    };
  }
  const client = new MongoClient(environment.MONGODB_URI!);
  const database = client.db(environment.MONGODB_DATABASE);
  return {
    repository: createMongoTailoringRepository(client, database),
    close: () => client.close(),
  };
}
