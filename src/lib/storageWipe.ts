import "server-only";

import {
  isS3ObjectStorageEnabled,
  s3DeleteObject,
  s3ListObjects,
} from "@/lib/s3ObjectStorage";

const S3_PREFIXES = ["documents/", "imports/", "firm/"] as const;

export type StorageWipeSummary = {
  s3Enabled: boolean;
  prefixes: Record<string, { listed: number; deleted: number }>;
};

export async function wipeTenantObjectStorage(): Promise<StorageWipeSummary> {
  const prefixes: StorageWipeSummary["prefixes"] = {};

  if (!isS3ObjectStorageEnabled()) {
    return { s3Enabled: false, prefixes };
  }

  for (const prefix of S3_PREFIXES) {
    const objects = await s3ListObjects(prefix);
    let deleted = 0;
    for (const obj of objects) {
      await s3DeleteObject(obj.key);
      deleted += 1;
    }
    prefixes[prefix] = { listed: objects.length, deleted };
  }

  return { s3Enabled: true, prefixes };
}
