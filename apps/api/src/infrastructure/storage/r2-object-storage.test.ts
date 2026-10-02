import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadEnvironment } from "../../config/environment.js";
import { createR2ObjectStorage, fileSignature } from "./r2-object-storage.js";

const mocks = vi.hoisted(() => ({
  signedCommandInput: null as Record<string, unknown> | null,
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(
    async (_client: unknown, command: { input: Record<string, unknown> }) => {
      mocks.signedCommandInput = command.input;
      return "https://example.r2.cloudflarestorage.com/signed-upload";
    },
  ),
}));

beforeEach(() => {
  mocks.signedCommandInput = null;
});

describe("resume file signatures", () => {
  it.each([
    ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      [0x50, 0x4b, 0x03, 0x04],
    ],
    ["image/jpeg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    [
      "image/webp",
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
    ],
  ])("detects %s content", (mimeType, bytes) => {
    expect(fileSignature.detectMimeType(Uint8Array.from(bytes))).toBe(mimeType);
  });

  it("rejects an unknown signature", () => {
    expect(fileSignature.detectMimeType(Uint8Array.from([1, 2, 3, 4]))).toBe(
      null,
    );
  });

  it("binds the declared content length into the signed PUT request", async () => {
    const storage = createR2ObjectStorage(
      loadEnvironment({
        R2_ACCOUNT_ID: "account-id",
        R2_ACCESS_KEY_ID: "access-key",
        R2_SECRET_ACCESS_KEY: "secret-key",
        R2_BUCKET_NAME: "resume-files",
      }),
    );

    await storage!.createUploadUrl({
      mimeType: "application/pdf",
      objectKey: "users/user-1/resumes/resume-1/original/file-1.pdf",
      size: 10 * 1024 * 1024,
    });

    expect(mocks.signedCommandInput).toMatchObject({
      ContentLength: 10 * 1024 * 1024,
      ContentType: "application/pdf",
    });
  });
});
