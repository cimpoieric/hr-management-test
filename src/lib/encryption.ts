/**
 * Criptare AES-256-GCM pentru date sensibile (CNP, IBAN).
 *
 * Folosește ENCRYPTION_KEY din .env (hex string, 64 caractere = 32 bytes).
 * Textul criptat este stocat ca string hex: iv(32hex) + authTag(32hex) + ciphertext.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

function getKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY invalid: must be a 64-character hex string (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return Buffer.from(envKey, "hex");
}

/**
 * Criptează un text. Returnează string hex: iv + authTag + ciphertext.
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv (hex) + authTag (hex) + ciphertext (hex)
  return iv.toString("hex") + authTag.toString("hex") + encrypted;
}

/**
 * Decriptează un string hex produs de `encrypt()`.
 */
export function decrypt(encryptedHex: string): string {
  const key = getKey();

  const iv = Buffer.from(encryptedHex.slice(0, 32), "hex");
  const authTag = Buffer.from(encryptedHex.slice(32, 64), "hex");
  const ciphertext = encryptedHex.slice(64);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generează SHA-256 hash pentru un string.
 * Utilizat pentru indexare rapidă și lookup (CNP hash, IBAN hash).
 */
export function hashSha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
