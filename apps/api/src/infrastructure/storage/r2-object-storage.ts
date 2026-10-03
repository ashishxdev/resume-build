import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { ResumeMimeType } from "@make-my-resume/contracts";

import type { Environment } from "../../config/environment.js";

const uploadUrlLifetimeSeconds = 15 * 60;

export interface StoredObjectInspection {
  detectedMimeType: ResumeMimeType | null;
  etag: string | null;
  reportedMimeType: string | null;
  size: number;
}

export interface ResumeObjectStorage {
  createUploadUrl(input: {
    mimeType: ResumeMimeType;
    objectKey: string;
    size: number;
  }): Promise<{ expiresAt: string; uploadUrl: string }>;
  deleteObject(objectKey: string): Promise<void>;
  inspectObject(objectKey: string): Promise<StoredObjectInspection>;
  readObject(objectKey: string): Promise<Uint8Array>;
}

function detectMimeType(bytes: Uint8Array): ResumeMimeType | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }

  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  return null;
}

export function createR2ObjectStorage(
  environment: Environment,
): ResumeObjectStorage | null {
  if (
    !environment.R2_ACCOUNT_ID ||
    !environment.R2_ACCESS_KEY_ID ||
    !environment.R2_SECRET_ACCESS_KEY ||
    !environment.R2_BUCKET_NAME
  ) {
    return null;
  }

  const bucket = environment.R2_BUCKET_NAME;
  const endpoint =
    environment.R2_ENDPOINT ??
    `https://${environment.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const client = new S3Client({
    region: "auto",
    endpoint: endpoint.replace(/\/$/, ""),
    credentials: {
      accessKeyId: environment.R2_ACCESS_KEY_ID,
      secretAccessKey: environment.R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    async createUploadUrl({ mimeType, objectKey, size }) {
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          ContentLength: size,
          Key: objectKey,
          ContentType: mimeType,
        }),
        { expiresIn: uploadUrlLifetimeSeconds },
      );

      return {
        uploadUrl,
        expiresAt: new Date(
          Date.now() + uploadUrlLifetimeSeconds * 1000,
        ).toISOString(),
      };
    },

    async deleteObject(objectKey) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
    },

    async inspectObject(objectKey) {
      const [head, prefix] = await Promise.all([
        client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey })),
        client.send(
          new GetObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            Range: "bytes=0-15",
          }),
        ),
      ]);
      const bytes = prefix.Body
        ? await prefix.Body.transformToByteArray()
        : new Uint8Array();

      return {
        detectedMimeType: detectMimeType(bytes),
        etag: head.ETag?.replaceAll('"', "") ?? null,
        reportedMimeType: head.ContentType ?? null,
        size: head.ContentLength ?? 0,
      };
    },

    async readObject(objectKey) {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
      if (!object.Body) throw new Error("Stored resume object is empty.");
      return object.Body.transformToByteArray();
    },
  };
}

export const fileSignature = { detectMimeType };
