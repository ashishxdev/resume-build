import type {
  ResumeClaim,
  ResumePresentationSettings,
  ResumeVersionType,
} from "@make-my-resume/contracts";

export interface MemoryStoredResumeVersion {
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

export interface MemoryResumeStore {
  resumeNames: Map<string, string>;
  activeVersionIds: Map<string, string | null>;
  versions: Map<string, MemoryStoredResumeVersion[]>;
}

export function createMemoryResumeStore(): MemoryResumeStore {
  return {
    resumeNames: new Map(),
    activeVersionIds: new Map(),
    versions: new Map(),
  };
}

export function removeMemoryResumeVersions(
  store: MemoryResumeStore,
  predicate: (version: MemoryStoredResumeVersion) => boolean,
) {
  for (const [resumeId, versions] of store.versions) {
    const remaining = versions.filter((version) => !predicate(version));
    if (remaining.length > 0) store.versions.set(resumeId, remaining);
    else store.versions.delete(resumeId);

    const activeVersionId = store.activeVersionIds.get(resumeId);
    if (
      activeVersionId &&
      !remaining.some((version) => version.id === activeVersionId)
    ) {
      store.activeVersionIds.set(resumeId, remaining.at(-1)?.id ?? null);
    }
  }
}
