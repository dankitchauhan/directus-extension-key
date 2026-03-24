/**
 * Provider factory and the public getKey() helper.
 *
 * Usage in other extensions:
 *   import { getKey } from '../providers';
 *   const secret = await getKey('MY_API_KEY', database);
 */
import { resolveFromDatabase } from './database.js';
import { resolveFromFile } from './file.js';
import { resolveFromEnv } from './env.js';
import { resolveFromExternal } from './external.js';

export type KeyProvider = 'database' | 'file' | 'env' | 'external';

export interface KeyRecord {
  id: string;
  name: string;
  provider: KeyProvider;
  value: string | null;   // encrypted, only used by database provider
  source: string | null;  // file path / env var name / URL
  description: string | null;
  date_created: string;
  date_updated: string;
}

/**
 * Resolve the plaintext value of a named key using its configured provider.
 * @param name     The unique key name as stored in directus_keys
 * @param database A Knex instance (available from the Directus hook/endpoint context)
 */
export async function getKey(name: string, database: any): Promise<string> {
  const row: KeyRecord | undefined = await database('directus_keys')
    .where({ name })
    .first();

  if (!row) {
    throw new Error(`[KeyManager] Key "${name}" not found.`);
  }

  switch (row.provider) {
    case 'database':
      return resolveFromDatabase(name, database);

    case 'file':
      if (!row.source) {
        throw new Error(`[KeyManager] Key "${name}" (file provider) has no source path.`);
      }
      return resolveFromFile(row.source);

    case 'env':
      if (!row.source) {
        throw new Error(`[KeyManager] Key "${name}" (env provider) has no env var name.`);
      }
      return resolveFromEnv(row.source);

    case 'external':
      if (!row.source) {
        throw new Error(`[KeyManager] Key "${name}" (external provider) has no URL.`);
      }
      return resolveFromExternal(row.source);

    default:
      throw new Error(`[KeyManager] Unknown provider "${(row as any).provider}" for key "${name}".`);
  }
}
