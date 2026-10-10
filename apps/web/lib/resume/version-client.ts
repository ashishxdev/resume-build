import {
  type ResumeExportFormat,
  type ResumePresentationSettings,
  type ResumeTemplateDensity,
  resumeVersionListSchema,
  resumeVersionSchema,
  type ResumeVersion,
  type ResumeVersionList,
} from "@make-my-resume/contracts";
import { z } from "zod";

import { clientEnvironment } from "@/lib/env/client";

const errorEnvelope = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
  }),
});

export class ResumeVersionApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ResumeVersionApiError";
  }
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(
    `${clientEnvironment.NEXT_PUBLIC_API_URL}${path}`,
    {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    },
  );
  if (!response.ok) {
    const parsed = errorEnvelope.safeParse(
      await response.json().catch(() => null),
    );
    throw new ResumeVersionApiError(
      parsed.success
        ? (parsed.data.error.message ?? "The request could not be completed.")
        : "The request could not be completed.",
      parsed.success ? parsed.data.error.code : undefined,
      response.status,
    );
  }
  return response;
}

function versionPath(resumeId: string, versionId?: string) {
  const root = `/api/v1/resumes/${encodeURIComponent(resumeId)}/versions`;
  return versionId ? `${root}/${encodeURIComponent(versionId)}` : root;
}

export async function listResumeVersions(
  resumeId: string,
): Promise<ResumeVersionList> {
  const response = await request(versionPath(resumeId));
  const parsed = z
    .object({ data: resumeVersionListSchema })
    .safeParse(await response.json());
  if (!parsed.success)
    throw new ResumeVersionApiError("The version history was invalid.");
  return parsed.data.data;
}

export async function getResumeVersion(
  resumeId: string,
  versionId: string,
): Promise<ResumeVersion> {
  const response = await request(versionPath(resumeId, versionId));
  const parsed = z
    .object({ data: resumeVersionSchema })
    .safeParse(await response.json());
  if (!parsed.success)
    throw new ResumeVersionApiError("The resume version was invalid.");
  return parsed.data.data;
}

export async function renameResumeVersion(
  resumeId: string,
  versionId: string,
  name: string,
) {
  const response = await request(versionPath(resumeId, versionId), {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  const parsed = z
    .object({ data: resumeVersionSchema })
    .safeParse(await response.json());
  if (!parsed.success)
    throw new ResumeVersionApiError("The renamed version was invalid.");
  return parsed.data.data;
}

export async function updateResumeVersionPresentation(
  resumeId: string,
  versionId: string,
  presentation: ResumePresentationSettings,
) {
  const response = await request(
    `${versionPath(resumeId, versionId)}/presentation`,
    {
      method: "PATCH",
      body: JSON.stringify(presentation),
    },
  );
  const parsed = z
    .object({ data: resumeVersionSchema })
    .safeParse(await response.json());
  if (!parsed.success)
    throw new ResumeVersionApiError("The saved design settings were invalid.");
  return parsed.data.data;
}

export async function activateResumeVersion(
  resumeId: string,
  versionId: string,
) {
  await request(`${versionPath(resumeId, versionId)}/activate`, {
    method: "POST",
  });
}

export async function restoreResumeVersion(
  resumeId: string,
  versionId: string,
) {
  const response = await request(
    `${versionPath(resumeId, versionId)}/restore`,
    {
      method: "POST",
    },
  );
  const parsed = z
    .object({ data: resumeVersionSchema })
    .safeParse(await response.json());
  if (!parsed.success)
    throw new ResumeVersionApiError("The restored version was invalid.");
  return parsed.data.data;
}

export async function deleteResumeVersion(resumeId: string, versionId: string) {
  await request(versionPath(resumeId, versionId), { method: "DELETE" });
}

export async function downloadResumeVersion(
  resumeId: string,
  versionId: string,
  format: ResumeExportFormat,
  density?: ResumeTemplateDensity,
) {
  const parameters = new URLSearchParams({ format });
  if (density) parameters.set("density", density);
  const response = await request(
    `${versionPath(resumeId, versionId)}/export?${parameters}`,
  );
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? `resume-version.${format}`;
  return { blob: await response.blob(), filename };
}
