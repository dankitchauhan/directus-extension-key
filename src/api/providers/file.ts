/**
 * File Provider
 * Reads the key value from a file path on the server.
 * The `source` field of the key record contains the absolute file path.
 */
import { readFile } from 'fs/promises';

export async function resolveFromFile(source: string): Promise<string> {
  if (!source) {
    throw new Error('[KeyManager] File provider requires a file path in the "source" field.');
  }

  try {
    const content = await readFile(source, 'utf8');
    return content.trim();
  } catch (err: any) {
    throw new Error(
      `[KeyManager] Failed to read key file at "${source}": ${err.message}`
    );
  }
}
