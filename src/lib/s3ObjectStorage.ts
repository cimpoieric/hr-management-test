import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type S3ListedObject = {
  key: string;
  size: number;
  lastModified: Date;
};

let s3Client: S3Client | null = null;

export function isS3ObjectStorageEnabled(): boolean {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim(),
  );
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("S3_BUCKET is not configured.");
  }
  return bucket;
}

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const region = process.env.S3_REGION?.trim() || "auto";
  const endpoint = process.env.S3_ENDPOINT?.trim();

  s3Client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
  });

  return s3Client;
}

function normalizeKey(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

/** Public URL for R2 custom domain / public bucket (optional `S3_PUBLIC_BASE_URL`). */
export function s3PublicUrlForKey(key: string): string | null {
  const base = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${normalizeKey(key)}`;
}

/** Reverse of `s3PublicUrlForKey` when deleting by stored HTTPS URL. */
export function s3KeyFromPublicUrl(url: string): string | null {
  const base = process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!base) return null;
  const normalizedBase = base.replace(/\/+$/, "");
  if (!url.startsWith(`${normalizedBase}/`)) return null;
  return normalizeKey(url.slice(normalizedBase.length + 1));
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new Error("Empty S3 object body");
  }
  const stream = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };
  if (typeof stream.transformToByteArray === "function") {
    const bytes = await stream.transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function s3PutObject(
  key: string,
  buffer: Buffer,
  contentType?: string,
): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: normalizeKey(key),
      Body: buffer,
      ContentType: contentType,
    }),
  );
}

export async function s3GetObject(key: string): Promise<Buffer> {
  const res = await getS3Client().send(
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: normalizeKey(key),
    }),
  );
  return streamToBuffer(res.Body);
}

export async function s3HeadObject(key: string): Promise<boolean> {
  try {
    await getS3Client().send(
      new HeadObjectCommand({
        Bucket: getBucket(),
        Key: normalizeKey(key),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function s3DeleteObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: normalizeKey(key),
    }),
  );
}

export async function s3CopyObject(
  sourceKey: string,
  destKey: string,
): Promise<void> {
  const body = await s3GetObject(sourceKey);
  await s3PutObject(destKey, body);
}

/** URL semnat pentru desc?rcare temporar? (implicit 1 or?). */
export async function s3GetPresignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({
      Bucket: getBucket(),
      Key: normalizeKey(key),
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function s3ListObjects(prefix: string): Promise<S3ListedObject[]> {
  const items: S3ListedObject[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await getS3Client().send(
      new ListObjectsV2Command({
        Bucket: getBucket(),
        Prefix: normalizeKey(prefix),
        ContinuationToken: continuationToken,
      }),
    );

    for (const obj of res.Contents ?? []) {
      if (obj.Key && obj.Size != null && obj.LastModified) {
        items.push({
          key: obj.Key,
          size: obj.Size,
          lastModified: obj.LastModified,
        });
      }
    }

    continuationToken = res.IsTruncated
      ? res.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return items;
}
