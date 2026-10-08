import {
  createResumeImportRequestSchema,
  createResumeImportResponseSchema,
  MAX_RESUME_FILE_SIZE,
  resumeImportSchema,
  resumeSummarySchema,
  type CreateResumeImportRequest,
  type ResumeMimeType,
  type ResumeSourceType,
  type ResumeSummary,
} from "@make-my-resume/contracts";
import { z } from "zod";

import { clientEnvironment } from "@/lib/env/client";

const apiEnvelope = <Schema extends z.ZodType>(schema: Schema) =>
  z.object({ data: schema });

const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string().optional(),
  }),
});

const extensionMimeTypes: Record<string, ResumeMimeType> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
};

export class ResumeImportApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ResumeImportApiError";
  }
}

async function apiRequest(path: string, init?: RequestInit) {
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
    const body = apiErrorSchema.safeParse(
      await response.json().catch(() => null),
    );
    throw new ResumeImportApiError(
      body.success
        ? body.data.error.message || "The request could not be completed."
        : "The request could not be completed.",
      body.success ? body.data.error.code : undefined,
      response.status,
    );
  }

  return response;
}

function mimeTypeForFile(file: File): ResumeMimeType | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extensionMimeType = extensionMimeTypes[extension];
  if (!extensionMimeType) return null;
  if (file.type && file.type !== extensionMimeType) return null;
  return extensionMimeType;
}

function sourceTypeForMimeType(mimeType: ResumeMimeType): ResumeSourceType {
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "docx";
}

export function validateResumeFile(
  file: File,
):
  | { data: CreateResumeImportRequest; error?: never }
  | { data?: never; error: string } {
  if (file.size === 0) {
    return { error: "Choose a file that is not empty." };
  }
  if (file.size > MAX_RESUME_FILE_SIZE) {
    return { error: "Choose a file smaller than 10 MB." };
  }

  const mimeType = mimeTypeForFile(file);
  if (!mimeType) {
    return { error: "Choose a PDF or DOCX file. Images are not supported." };
  }

  const parsed = createResumeImportRequestSchema.safeParse({
    fileName: file.name,
    mimeType,
    size: file.size,
    sourceType: sourceTypeForMimeType(mimeType),
  });
  return parsed.success
    ? { data: parsed.data }
    : {
        error: parsed.error.issues[0]?.message ?? "Choose a valid resume file.",
      };
}

export async function listResumes(): Promise<ResumeSummary[]> {
  const response = await apiRequest("/api/v1/resumes");
  const parsed = apiEnvelope(z.array(resumeSummarySchema)).safeParse(
    await response.json(),
  );
  if (!parsed.success) {
    throw new ResumeImportApiError("The resume library returned invalid data.");
  }
  return parsed.data.data;
}

export async function deleteResume(resumeId: string) {
  await apiRequest(`/api/v1/resumes/${encodeURIComponent(resumeId)}`, {
    method: "DELETE",
  });
}

export async function createResumeImport(input: CreateResumeImportRequest) {
  const response = await apiRequest("/api/v1/imports", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const parsed = apiEnvelope(createResumeImportResponseSchema).safeParse(
    await response.json(),
  );
  if (!parsed.success) {
    throw new ResumeImportApiError("The upload session returned invalid data.");
  }
  return parsed.data.data;
}

export async function completeResumeImport(importId: string) {
  const response = await apiRequest(`/api/v1/imports/${importId}/complete`, {
    method: "POST",
  });
  const parsed = apiEnvelope(resumeImportSchema).safeParse(
    await response.json(),
  );
  if (!parsed.success) {
    throw new ResumeImportApiError(
      "The completed import returned invalid data.",
    );
  }
  return parsed.data.data;
}

export async function cancelResumeImport(importId: string) {
  await apiRequest(`/api/v1/imports/${importId}`, { method: "DELETE" });
}

export function uploadResumeObject(
  uploadUrl: string,
  contentType: ResumeMimeType,
  file: File,
  onProgress: (progress: number) => void,
) {
  const request = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", contentType);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new ResumeImportApiError("Cloud storage rejected the upload."));
      }
    });
    request.addEventListener("error", () => {
      reject(
        new ResumeImportApiError(
          "The upload could not reach cloud storage. Check the R2 bucket CORS configuration and try again.",
        ),
      );
    });
    request.addEventListener("abort", () => {
      reject(new DOMException("The upload was cancelled.", "AbortError"));
    });
    request.send(file);
  });

  return { abort: () => request.abort(), promise };
}
