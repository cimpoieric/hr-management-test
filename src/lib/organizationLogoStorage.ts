import "server-only";

import { sanitizeFilename } from "@/lib/documentConstants";
import {
  isS3ObjectStorageEnabled,
  s3DeleteObject,
  s3GetObject,
  s3HeadObject,
  s3KeyFromPublicUrl,
  s3PublicUrlForKey,
  s3PutObject,
} from "@/lib/s3ObjectStorage";
import { existsSync } from "fs";
import { join } from "path";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";

const SETTINGS_ROOT = join(process.cwd(), "data", "settings");
const LOGO_KEY_PREFIX = "firm/";

function shouldUseS3Storage(): boolean {
  return isS3ObjectStorageEnabled();
}

function assertLocalAllowed(): void {
  if (process.env.VERCEL === "1" && !shouldUseS3Storage()) {
    throw new Error(
      "Logo-ul necesita stocare R2/S3 pe Vercel. Configureaza S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY si S3_ENDPOINT.",
    );
  }
}

function logoDirForOrganization(organizationId: string): string {
  return join(SETTINGS_ROOT, organizationId);
}

function legacyLocalLogoPath(organizationId: string): string {
  return join(logoDirForOrganization(organizationId), "logo.png");
}

function isHttpUrl(value: string | null | undefined): value is string {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function isLogoS3Key(value: string): boolean {
  return (
    value.startsWith(LOGO_KEY_PREFIX) &&
    value.includes("/logo/")
  );
}

function mimeForLogoFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/png";
}

function bufferToDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export function buildOrganizationLogoS3Key(
  organizationId: string,
  originalFilename: string,
): string {
  const timestamp = Date.now();
  const safeName = sanitizeFilename(originalFilename) || "logo.png";
  return `${LOGO_KEY_PREFIX}${organizationId}/logo/${timestamp}-${safeName}`;
}

async function ensureSettingsDir(organizationId: string): Promise<void> {
  const dir = logoDirForOrganization(organizationId);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function deleteLocalLogo(organizationId: string): Promise<void> {
  const logoPath = legacyLocalLogoPath(organizationId);
  if (existsSync(logoPath)) {
    await unlink(logoPath);
  }
}

async function deleteS3Logo(storedLogoUrl: string): Promise<void> {
  if (!shouldUseS3Storage()) return;

  if (isLogoS3Key(storedLogoUrl)) {
    await s3DeleteObject(storedLogoUrl);
    return;
  }

  if (isHttpUrl(storedLogoUrl)) {
    const key = s3KeyFromPublicUrl(storedLogoUrl);
    if (key) {
      await s3DeleteObject(key);
    }
  }
}

export async function uploadOrganizationLogo(
  organizationId: string,
  file: File,
  buffer: Buffer,
): Promise<{ url: string; size: number; storage: "s3" | "local" }> {
  const filename = file.name?.trim() || "logo.png";

  if (shouldUseS3Storage()) {
    const key = buildOrganizationLogoS3Key(organizationId, filename);
    await s3PutObject(key, buffer, file.type || mimeForLogoFilename(filename));
    const url = s3PublicUrlForKey(key) ?? key;
    return { url, size: buffer.length, storage: "s3" };
  }

  assertLocalAllowed();
  await ensureSettingsDir(organizationId);
  const logoPath = legacyLocalLogoPath(organizationId);
  await writeFile(logoPath, buffer);
  return { url: logoPath, size: buffer.length, storage: "local" };
}

export async function resolveOrganizationLogo(
  organizationId: string,
  storedLogoUrl: string | null | undefined,
): Promise<{ exists: boolean; url?: string; size?: number }> {
  if (storedLogoUrl) {
    if (isHttpUrl(storedLogoUrl)) {
      return { exists: true, url: storedLogoUrl };
    }

    if (isLogoS3Key(storedLogoUrl) && shouldUseS3Storage()) {
      const publicUrl = s3PublicUrlForKey(storedLogoUrl);
      if (publicUrl) {
        return { exists: true, url: publicUrl };
      }

      const exists = await s3HeadObject(storedLogoUrl);
      if (!exists) {
        return { exists: false };
      }

      const buffer = await s3GetObject(storedLogoUrl);
      const mime = mimeForLogoFilename(storedLogoUrl);
      return {
        exists: true,
        url: bufferToDataUrl(buffer, mime),
        size: buffer.length,
      };
    }
  }

  const logoPath = legacyLocalLogoPath(organizationId);
  if (!existsSync(logoPath)) {
    return { exists: false };
  }

  const buffer = await readFile(logoPath);
  return {
    exists: true,
    url: bufferToDataUrl(buffer, "image/png"),
    size: buffer.length,
  };
}

export async function clearOrganizationLogo(
  organizationId: string,
  storedLogoUrl: string | null | undefined,
): Promise<void> {
  if (storedLogoUrl) {
    await deleteS3Logo(storedLogoUrl);
  }
  await deleteLocalLogo(organizationId);
}
