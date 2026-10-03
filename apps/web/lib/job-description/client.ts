import {
  createJobDescriptionRequestSchema,
  jobDescriptionSchema,
  type CreateJobDescriptionRequest,
} from "@make-my-resume/contracts";
import { z } from "zod";

import { clientEnvironment } from "@/lib/env/client";

const envelope = z.object({ data: jobDescriptionSchema });
const errorEnvelope = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
  }),
});

export class JobDescriptionApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
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
    throw new JobDescriptionApiError(
      parsed.success
        ? (parsed.data.error.message ?? "The request could not be completed.")
        : "The request could not be completed.",
      parsed.success ? parsed.data.error.code : undefined,
      response.status,
    );
  }
  const parsed = envelope.safeParse(await response.json());
  if (!parsed.success)
    throw new JobDescriptionApiError("The analysis response was invalid.");
  return parsed.data.data;
}

export function createJobDescription(input: CreateJobDescriptionRequest) {
  const body = createJobDescriptionRequestSchema.parse(input);
  return request("/api/v1/job-descriptions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getJobDescription(id: string) {
  return request(`/api/v1/job-descriptions/${encodeURIComponent(id)}`);
}

export function retryJobDescriptionAnalysis(id: string) {
  return request(`/api/v1/job-descriptions/${encodeURIComponent(id)}/analyze`, {
    method: "POST",
  });
}
