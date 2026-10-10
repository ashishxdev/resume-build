import type {
  ResumeClaim,
  ResumePresentationSettings,
  ResumeVersionType,
} from "@make-my-resume/contracts";
import { normalizeResumePresentation } from "@make-my-resume/resume-engine";
import { MongoClient, type Db } from "mongodb";

import type { Environment } from "../../config/environment.js";
import type { TailoringRepository } from "../tailoring/tailoring-repository.js";
import { createId } from "../../shared/ids/create-id.js";

export interface ResumeVersionRecord {
  id: string;
  resumeId: string;
  userId: string;
  name: string;
  type: ResumeVersionType;
  sourceVersionId: string | null;
  jobDescriptionId: string | null;
  tailoringSessionId: string | null;
  company: string | null;
  role: string | null;
  claims: ResumeClaim[];
  presentation: ResumePresentationSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResumeVersionCollection {
  resumeId: string;
  resumeName: string;
  activeVersionId: string | null;
  versions: ResumeVersionRecord[];
}

export type DeleteResumeVersionResult =
  | { status: "deleted"; deletedVersionIds: string[] }
  | { status: "not_found" }
  | { status: "base" }
  | { status: "active" }
  | { status: "referenced" };

export interface ResumeVersionRepository {
  listOwned(
    userId: string,
    resumeId: string,
  ): Promise<ResumeVersionCollection | null>;
  findOwned(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<ResumeVersionRecord | null>;
  renameOwned(
    userId: string,
    resumeId: string,
    versionId: string,
    name: string,
  ): Promise<ResumeVersionRecord | null>;
  updatePresentationOwned(
    userId: string,
    resumeId: string,
    versionId: string,
    presentation: ResumePresentationSettings,
  ): Promise<ResumeVersionRecord | null>;
  activateOwned(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<boolean>;
  restoreOwned(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<ResumeVersionRecord | null>;
  deleteOwned(
    userId: string,
    resumeId: string,
    versionId: string,
  ): Promise<DeleteResumeVersionResult>;
}

export interface MemoryResumeVersionSeed {
  resumeId: string;
  resumeName: string;
  activeVersionId?: string | null;
  versions: ResumeVersionRecord[];
}

function cloneRecord(record: ResumeVersionRecord) {
  return structuredClone(record);
}

function resolvedActiveVersionId(
  requested: string | null | undefined,
  versions: ResumeVersionRecord[],
) {
  if (requested && versions.some((version) => version.id === requested)) {
    return requested;
  }
  return versions.at(-1)?.id ?? null;
}

function restoredName(source: ResumeVersionRecord) {
  return `Restored — ${source.name}`.slice(0, 120);
}

export function createMemoryResumeVersionRepository(
  initial: MemoryResumeVersionSeed[] = [],
  tailoringRepository?: TailoringRepository,
): ResumeVersionRepository {
  const collections = new Map(
    initial.map((collection) => [
      collection.resumeId,
      {
        resumeId: collection.resumeId,
        resumeName: collection.resumeName,
        activeVersionId: collection.activeVersionId ?? null,
        versions: collection.versions.map(cloneRecord),
      },
    ]),
  );

  function ownedCollection(userId: string, resumeId: string) {
    const collection = collections.get(resumeId);
    if (
      !collection ||
      !collection.versions.some((item) => item.userId === userId)
    ) {
      return null;
    }
    return collection;
  }

  return {
    async listOwned(userId, resumeId) {
      const collection = ownedCollection(userId, resumeId);
      if (!collection) return null;
      const versions = collection.versions
        .filter((version) => version.userId === userId)
        .sort(
          (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
        )
        .map(cloneRecord);
      return {
        resumeId,
        resumeName: collection.resumeName,
        activeVersionId: resolvedActiveVersionId(
          collection.activeVersionId,
          versions,
        ),
        versions,
      };
    },

    async findOwned(userId, resumeId, versionId) {
      const collection = ownedCollection(userId, resumeId);
      const record = collection?.versions.find(
        (version) => version.id === versionId && version.userId === userId,
      );
      return record ? cloneRecord(record) : null;
    },

    async renameOwned(userId, resumeId, versionId, name) {
      const collection = ownedCollection(userId, resumeId);
      const record = collection?.versions.find(
        (version) => version.id === versionId && version.userId === userId,
      );
      if (!record) return null;
      record.name = name;
      record.updatedAt = new Date();
      return cloneRecord(record);
    },

    async updatePresentationOwned(userId, resumeId, versionId, presentation) {
      const collection = ownedCollection(userId, resumeId);
      const record = collection?.versions.find(
        (version) => version.id === versionId && version.userId === userId,
      );
      if (!record) return null;
      record.presentation = normalizeResumePresentation(presentation);
      record.updatedAt = new Date();
      return cloneRecord(record);
    },

    async activateOwned(userId, resumeId, versionId) {
      const collection = ownedCollection(userId, resumeId);
      if (
        !collection?.versions.some(
          (version) => version.id === versionId && version.userId === userId,
        )
      ) {
        return false;
      }
      collection.activeVersionId = versionId;
      return true;
    },

    async restoreOwned(userId, resumeId, versionId) {
      const collection = ownedCollection(userId, resumeId);
      const source = collection?.versions.find(
        (version) => version.id === versionId && version.userId === userId,
      );
      if (!collection || !source) return null;
      const now = new Date();
      const restored: ResumeVersionRecord = {
        ...cloneRecord(source),
        id: createId("version"),
        name: restoredName(source),
        type: "restored",
        sourceVersionId: source.id,
        tailoringSessionId: null,
        createdAt: now,
        updatedAt: now,
      };
      collection.versions.push(restored);
      collection.activeVersionId = restored.id;
      return cloneRecord(restored);
    },

    async deleteOwned(userId, resumeId, versionId) {
      const collection = ownedCollection(userId, resumeId);
      const record = collection?.versions.find(
        (version) => version.id === versionId && version.userId === userId,
      );
      if (!collection || !record) return { status: "not_found" };
      const activeVersionId = resolvedActiveVersionId(
        collection.activeVersionId,
        collection.versions,
      );
      if (record.type === "base") return { status: "base" };
      const group = record.tailoringSessionId
        ? collection.versions.filter(
            (version) =>
              version.tailoringSessionId === record.tailoringSessionId,
          )
        : [record];
      if (group.some((version) => version.id === activeVersionId)) {
        return { status: "active" };
      }
      const groupIds = new Set(group.map((version) => version.id));
      if (
        collection.versions.some(
          (version) =>
            !groupIds.has(version.id) &&
            version.sourceVersionId !== null &&
            groupIds.has(version.sourceVersionId),
        )
      ) {
        return { status: "referenced" };
      }
      if (record.tailoringSessionId && tailoringRepository) {
        const deleted = await tailoringRepository.deleteOwned(
          userId,
          record.tailoringSessionId,
        );
        if (!deleted) return { status: "not_found" };
      }
      collection.versions = collection.versions.filter(
        (version) => !groupIds.has(version.id),
      );
      return { status: "deleted", deletedVersionIds: [...groupIds] };
    },
  };
}

interface MongoResumeVersionDocument {
  _id: string;
  resumeId: string;
  userId: string;
  name?: string;
  type: ResumeVersionType;
  baseVersionId?: string | null;
  sourceVersionId?: string | null;
  jobDescriptionId?: string | null;
  tailoringSessionId?: string | null;
  company?: string | null;
  role?: string | null;
  content: { claims: ResumeClaim[] };
  presentation?: ResumePresentationSettings;
  schemaVersion: number;
  verificationStatus: "verified";
  createdAt: Date;
  updatedAt: Date;
}

interface MongoResumeDocument {
  _id: string;
  userId: string;
  name: string;
  baseVersionId: string | null;
  activeVersionId?: string | null;
  isDeleted: boolean;
  updatedAt: Date;
}

function defaultVersionName(
  document: MongoResumeVersionDocument,
  company: string | null,
  role: string | null,
) {
  if (document.name?.trim()) return document.name.trim();
  if (document.type === "base") return "Verified baseline";
  const subject = [company, role].filter(Boolean).join(" — ");
  if (document.type === "ats_improved") {
    return `${subject || "Tailored resume"} — ATS improved`.slice(0, 120);
  }
  if (document.type === "restored") return "Restored version";
  return (subject || "Tailored resume").slice(0, 120);
}

function toRecord(
  document: MongoResumeVersionDocument,
  session?: { company: string | null; role: string | null },
): ResumeVersionRecord {
  const company = document.company ?? session?.company ?? null;
  const role = document.role ?? session?.role ?? null;
  return {
    id: document._id,
    resumeId: document.resumeId,
    userId: document.userId,
    name: defaultVersionName(document, company, role),
    type: document.type,
    sourceVersionId: document.sourceVersionId ?? document.baseVersionId ?? null,
    jobDescriptionId: document.jobDescriptionId ?? null,
    tailoringSessionId: document.tailoringSessionId ?? null,
    company,
    role,
    claims: structuredClone(document.content.claims),
    presentation: normalizeResumePresentation(document.presentation),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function createMongoResumeVersionRepository(
  client: MongoClient,
  database: Db,
  tailoringRepository: TailoringRepository,
): ResumeVersionRepository {
  const versions =
    database.collection<MongoResumeVersionDocument>("resume_versions");
  const resumes = database.collection<MongoResumeDocument>("resumes");

  async function sessionDetails(userId: string) {
    const records = await tailoringRepository.findManyOwned(userId);
    return new Map(
      records.map((record) => [
        record.id,
        { company: record.company, role: record.role },
      ]),
    );
  }

  async function ownedResume(userId: string, resumeId: string) {
    return resumes.findOne({ _id: resumeId, userId, isDeleted: false });
  }

  async function listOwned(userId: string, resumeId: string) {
    const resume = await ownedResume(userId, resumeId);
    if (!resume) return null;
    const [documents, sessions] = await Promise.all([
      versions
        .find({ userId, resumeId })
        .sort({ createdAt: 1, _id: 1 })
        .toArray(),
      sessionDetails(userId),
    ]);
    const records = documents.map((document) =>
      toRecord(
        document,
        document.tailoringSessionId
          ? sessions.get(document.tailoringSessionId)
          : undefined,
      ),
    );
    return {
      resumeId,
      resumeName: resume.name,
      activeVersionId: resolvedActiveVersionId(resume.activeVersionId, records),
      versions: records,
    };
  }

  return {
    listOwned,

    async findOwned(userId, resumeId, versionId) {
      if (!(await ownedResume(userId, resumeId))) return null;
      const document = await versions.findOne({
        _id: versionId,
        userId,
        resumeId,
      });
      if (!document) return null;
      const sessions = await sessionDetails(userId);
      return toRecord(
        document,
        document.tailoringSessionId
          ? sessions.get(document.tailoringSessionId)
          : undefined,
      );
    },

    async renameOwned(userId, resumeId, versionId, name) {
      if (!(await ownedResume(userId, resumeId))) return null;
      const document = await versions.findOneAndUpdate(
        { _id: versionId, userId, resumeId },
        { $set: { name, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!document) return null;
      const sessions = await sessionDetails(userId);
      return toRecord(
        document,
        document.tailoringSessionId
          ? sessions.get(document.tailoringSessionId)
          : undefined,
      );
    },

    async updatePresentationOwned(userId, resumeId, versionId, presentation) {
      if (!(await ownedResume(userId, resumeId))) return null;
      const document = await versions.findOneAndUpdate(
        { _id: versionId, userId, resumeId },
        {
          $set: {
            presentation: normalizeResumePresentation(presentation),
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" },
      );
      if (!document) return null;
      const sessions = await sessionDetails(userId);
      return toRecord(
        document,
        document.tailoringSessionId
          ? sessions.get(document.tailoringSessionId)
          : undefined,
      );
    },

    async activateOwned(userId, resumeId, versionId) {
      const version = await versions.findOne({
        _id: versionId,
        userId,
        resumeId,
      });
      if (!version) return false;
      const result = await resumes.updateOne(
        { _id: resumeId, userId, isDeleted: false },
        { $set: { activeVersionId: versionId, updatedAt: new Date() } },
      );
      return result.matchedCount === 1;
    },

    async restoreOwned(userId, resumeId, versionId) {
      const source = await versions.findOne({
        _id: versionId,
        userId,
        resumeId,
      });
      if (!source || !(await ownedResume(userId, resumeId))) return null;
      const sessions = await sessionDetails(userId);
      const sourceRecord = toRecord(
        source,
        source.tailoringSessionId
          ? sessions.get(source.tailoringSessionId)
          : undefined,
      );
      const session = client.startSession();
      let restored: MongoResumeVersionDocument | null = null;
      try {
        await session.withTransaction(async () => {
          const now = new Date();
          restored = {
            _id: createId("version"),
            resumeId,
            userId,
            name: restoredName(sourceRecord),
            type: "restored",
            baseVersionId: source._id,
            sourceVersionId: source._id,
            jobDescriptionId: source.jobDescriptionId ?? null,
            tailoringSessionId: null,
            company: sourceRecord.company,
            role: sourceRecord.role,
            content: structuredClone(source.content),
            presentation: sourceRecord.presentation,
            schemaVersion: 1,
            verificationStatus: "verified",
            createdAt: now,
            updatedAt: now,
          };
          await versions.insertOne(restored, { session });
          const updated = await resumes.updateOne(
            { _id: resumeId, userId, isDeleted: false },
            {
              $set: { activeVersionId: restored._id, updatedAt: now },
            },
            { session },
          );
          if (updated.matchedCount !== 1) {
            throw new Error("Resume state changed during restoration.");
          }
        });
        return restored ? toRecord(restored) : null;
      } finally {
        await session.endSession();
      }
    },

    async deleteOwned(userId, resumeId, versionId) {
      const collection = await listOwned(userId, resumeId);
      const record = collection?.versions.find(
        (version) => version.id === versionId,
      );
      if (!collection || !record) return { status: "not_found" };
      if (record.type === "base") return { status: "base" };
      const group = record.tailoringSessionId
        ? collection.versions.filter(
            (version) =>
              version.tailoringSessionId === record.tailoringSessionId,
          )
        : [record];
      if (group.some((version) => version.id === collection.activeVersionId)) {
        return { status: "active" };
      }
      const groupIds = group.map((version) => version.id);
      const referenced = await versions.findOne({
        userId,
        resumeId,
        _id: { $nin: groupIds },
        $or: [
          { sourceVersionId: { $in: groupIds } },
          { baseVersionId: { $in: groupIds } },
        ],
      });
      if (referenced) return { status: "referenced" };
      if (record.tailoringSessionId) {
        const deleted = await tailoringRepository.deleteOwned(
          userId,
          record.tailoringSessionId,
        );
        if (!deleted) return { status: "not_found" };
      } else {
        const deleted = await versions.deleteOne({
          _id: versionId,
          userId,
          resumeId,
          type: { $ne: "base" },
        });
        if (deleted.deletedCount !== 1) return { status: "not_found" };
      }
      return { status: "deleted", deletedVersionIds: groupIds };
    },
  };
}

export function createResumeVersionRepositoryRuntime(
  environment: Environment,
  tailoringRepository: TailoringRepository,
) {
  if (environment.AUTH_STORAGE !== "mongodb" || !environment.MONGODB_URI) {
    return {
      repository: createMemoryResumeVersionRepository([], tailoringRepository),
      close: async () => undefined,
    };
  }
  const client = new MongoClient(environment.MONGODB_URI);
  return {
    repository: createMongoResumeVersionRepository(
      client,
      client.db(environment.MONGODB_DATABASE),
      tailoringRepository,
    ),
    close: () => client.close(),
  };
}
