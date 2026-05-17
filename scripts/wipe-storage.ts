/**
 * Sterge fisierele HR din R2/S3 (prefixe cunoscute) si din data/ local.
 *
 * Usage:
 *   npx tsx scripts/wipe-storage.ts
 *   npx vercel env run --environment=production -- npx tsx scripts/wipe-storage.ts
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local", override: false });
dotenv.config({ path: ".env", override: false });
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { existsSync } from "fs";
import { rm, stat } from "fs/promises";
import { join } from "path";

const S3_PREFIXES = ["documents/", "imports/", "firm/"] as const;

const LOCAL_DIRS = [
  "documents",
  "import",
  "backups",
  "settings",
  "reports",
  "payslips",
  "logs",
] as const;

function isS3Enabled(): boolean {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim(),
  );
}

function getS3Client(): S3Client {
  const region = process.env.S3_REGION?.trim() || "auto";
  const endpoint = process.env.S3_ENDPOINT?.trim();
  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

function getBucket(): string {
  const bucket = process.env.S3_BUCKET?.trim();
  if (!bucket) throw new Error("S3_BUCKET is not configured.");
  return bucket;
}

async function listAllKeys(client: S3Client, prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;
  const bucket = getBucket();

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = res.IsTruncated
      ? res.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

async function deleteKeys(client: S3Client, keys: string[]): Promise<number> {
  const bucket = getBucket();
  let deleted = 0;

  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000);
    if (batch.length === 1) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: batch[0] }),
      );
      deleted += 1;
      continue;
    }
    const res = await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );
    deleted += res.Deleted?.length ?? 0;
    if (res.Errors?.length) {
      console.error("S3 delete errors:", res.Errors);
    }
  }

  return deleted;
}

async function wipeS3(): Promise<Record<string, number>> {
  const client = getS3Client();
  const summary: Record<string, number> = {};

  for (const prefix of S3_PREFIXES) {
    const keys = await listAllKeys(client, prefix);
    summary[prefix] = keys.length;
    if (keys.length === 0) continue;
    const deleted = await deleteKeys(client, keys);
    console.log(`S3 ${prefix}: listed ${keys.length}, deleted ${deleted}`);
  }

  return summary;
}

async function wipeLocalData(): Promise<Record<string, string>> {
  const base = join(process.cwd(), "data");
  const result: Record<string, string> = {};

  for (const dir of LOCAL_DIRS) {
    const path = join(base, dir);
    if (!existsSync(path)) {
      result[dir] = "missing";
      continue;
    }
    const st = await stat(path);
    if (!st.isDirectory()) {
      result[dir] = "not-a-dir";
      continue;
    }
    await rm(path, { recursive: true, force: true });
    result[dir] = "removed";
  }

  const documentsPath = process.env.DOCUMENTS_PATH?.trim();
  if (documentsPath && existsSync(documentsPath)) {
    await rm(documentsPath, { recursive: true, force: true });
    result["DOCUMENTS_PATH"] = "removed";
  }

  return result;
}

async function main() {
  const dryRun = process.env.WIPE_STORAGE_DRY_RUN === "1";

  console.log("S3 enabled:", isS3Enabled());
  if (dryRun) console.log("DRY RUN � no deletes");

  if (isS3Enabled()) {
    if (dryRun) {
      const client = getS3Client();
      for (const prefix of S3_PREFIXES) {
        const keys = await listAllKeys(client, prefix);
        console.log(`Would delete S3 ${prefix}: ${keys.length} objects`);
      }
    } else {
      const summary = await wipeS3();
      console.log("S3 summary (listed):", summary);
    }
  } else {
    console.log(
      "Skip S3: set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY (and S3_ENDPOINT for R2).",
    );
  }

  if (!dryRun) {
    const local = await wipeLocalData();
    console.log("Local data/:", local);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
