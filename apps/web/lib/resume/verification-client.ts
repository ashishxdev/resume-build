import {
  resumeVerificationSchema,
  updateResumeVerificationRequestSchema,
  type ResumeClaim,
  type ResumeVerification,
} from "@make-my-resume/contracts";
import { z } from "zod";

import { clientEnvironment } from "@/lib/env/client";
import { ResumeImportApiError } from "@/lib/resume/import-client";

const envelope = z.object({ data: resumeVerificationSchema });
const errorSchema = z.object({
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
    const parsed = errorSchema.safeParse(
      await response.json().catch(() => null),
    );
    throw new ResumeImportApiError(
      parsed.success
        ? (parsed.data.error.message ?? "The request could not be completed.")
        : "The request could not be completed.",
      parsed.success ? parsed.data.error.code : undefined,
      response.status,
    );
  }
  const parsed = envelope.safeParse(await response.json());
  if (!parsed.success) {
    throw new ResumeImportApiError("The verification response was invalid.");
  }
  return parsed.data.data;
}

export function getResumeVerification(resumeId: string) {
  return request(
    `/api/v1/resumes/${encodeURIComponent(resumeId)}/verification`,
  );
}

export function saveResumeVerification(
  resumeId: string,
  claims: ResumeClaim[],
): Promise<ResumeVerification> {
  const body = updateResumeVerificationRequestSchema.parse({ claims });
  return request(
    `/api/v1/resumes/${encodeURIComponent(resumeId)}/verification`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
}

export function retryResumeExtraction(resumeId: string) {
  return request(
    `/api/v1/resumes/${encodeURIComponent(resumeId)}/extraction/retry`,
    { method: "POST" },
  );
}
