/**
 * Database Provider
 * Stores the key value encrypted (AES-256-GCM) in the directus_keys table.
 * The encryption key is derived from the Directus SECRET environment variable.
 */
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function deriveKey(): Buffer {
  const secret = process.env['SECRET'] ?? 'fallback-insecure-secret';
  // Derive a 32-byte key via SHA-256 of the SECRET
  return createHash('sha256').update(secret).digest();
}

export function encryptValue(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: iv(12) + authTag(16) + ciphertext → base64
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

export function decryptValue(ciphertext: string): string {
  const key = deriveKey();
  const combined = Buffer.from(ciphertext, 'base64');

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const encrypted = combined.subarray(28);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export async function resolveFromDatabase(
  name: string,
  database: any
): Promise<string> {
  const row = await database('directus_keys')
    .where({ name })
    .first();

  if (!row) {
    throw new Error(`[KeyManager] Key "${name}" not found in database.`);
  }

  if (!row.value) {
    throw new Error(`[KeyManager] Key "${name}" has no stored value.`);
  }

  return decryptValue(row.value);
}
