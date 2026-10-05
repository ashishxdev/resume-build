import {
  type ResumeExportFormat,
  type ResumeTemplateDensity,
  tailoringSessionSchema,
  type TailoringSession,
} from "@make-my-resume/contracts";
import { z } from "zod";

import { clientEnvironment } from "@/lib/env/client";

const envelope = z.object({ data: tailoringSessionSchema });
const listEnvelope = z.object({ data: z.array(tailoringSessionSchema) });
const errorEnvelope = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
  }),
});

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
    throw new Error(
      parsed.success
        ? (parsed.data.error.message ?? "The request could not be completed.")
        : "The request could not be completed.",
    );
  }
  const parsed = envelope.safeParse(await response.json());
  if (!parsed.success) throw new Error("The tailoring response was invalid.");
  return parsed.data.data;
}

export function createTailoringSession(jobDescriptionId: string) {
  return request(
    `/api/v1/job-descriptions/${encodeURIComponent(jobDescriptionId)}/tailoring-sessions`,
    { method: "POST" },
  );
}

export function getTailoringSession(id: string) {
  return request(`/api/v1/tailoring-sessions/${encodeURIComponent(id)}`);
}

export async function listTailoringSessions() {
  const response = await fetch(
    `${clientEnvironment.NEXT_PUBLIC_API_URL}/api/v1/tailoring-sessions`,
    { credentials: "include" },
  );
  if (!response.ok)
    throw new Error("The tailored versions could not be loaded.");
  const parsed = listEnvelope.safeParse(await response.json());
  if (!parsed.success)
    throw new Error("The tailored versions response was invalid.");
  return parsed.data.data;
}

export function retryTailoringSession(id: string) {
  return request(`/api/v1/tailoring-sessions/${encodeURIComponent(id)}/retry`, {
    method: "POST",
  });
}

export function startAtsAnalysis(id: string) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(id)}/ats-analysis`,
    {
      method: "POST",
    },
  );
}

export function retryAtsAnalysis(id: string) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(id)}/ats-analysis/retry`,
    {
      method: "POST",
    },
  );
}

export function startAtsImprovements(id: string) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(id)}/ats-improvements`,
    { method: "POST" },
  );
}

export function retryAtsImprovements(id: string) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(id)}/ats-improvements/retry`,
    { method: "POST" },
  );
}

export function decideAtsImprovement(
  session: TailoringSession,
  suggestionId: string,
  status: "accepted" | "rejected",
  editedText?: string | null,
) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(session.id)}/ats-improvements/${encodeURIComponent(suggestionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ revision: session.revision, status, editedText }),
    },
  );
}

export function completeAtsImprovements(session: TailoringSession) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(session.id)}/ats-improvements/complete`,
    {
      method: "POST",
      body: JSON.stringify({ revision: session.revision }),
    },
  );
}

export function setAtsImprovedVersionActive(id: string, active: boolean) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(id)}/ats-improvements/active`,
    { method: "PATCH", body: JSON.stringify({ active }) },
  );
}

export function decideSuggestion(
  session: TailoringSession,
  suggestionId: string,
  status: "accepted" | "rejected",
  editedText?: string | null,
) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(session.id)}/suggestions/${encodeURIComponent(suggestionId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ revision: session.revision, status, editedText }),
    },
  );
}

export function decideAll(
  session: TailoringSession,
  decision: "accept-all" | "reject-all",
) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(session.id)}/suggestions/${decision}`,
    { method: "POST", body: JSON.stringify({ revision: session.revision }) },
  );
}

export function completeTailoringSession(session: TailoringSession) {
  return request(
    `/api/v1/tailoring-sessions/${encodeURIComponent(session.id)}/complete`,
    {
      method: "POST",
      body: JSON.stringify({ revision: session.revision }),
    },
  );
}

export async function downloadTailoredResume(
  id: string,
  format: ResumeExportFormat,
  density: ResumeTemplateDensity,
) {
  const parameters = new URLSearchParams({ format, density });
  const response = await fetch(
    `${clientEnvironment.NEXT_PUBLIC_API_URL}/api/v1/tailoring-sessions/${encodeURIComponent(id)}/export?${parameters}`,
    { credentials: "include" },
  );
  if (!response.ok) {
    const parsed = errorEnvelope.safeParse(
      await response.json().catch(() => null),
    );
    throw new Error(
      parsed.success
        ? (parsed.data.error.message ?? "The resume could not be exported.")
        : "The resume could not be exported.",
    );
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? `tailored-resume.${format}`;
  return { blob: await response.blob(), filename };
}
