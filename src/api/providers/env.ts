/**
 * Environment Variable Provider
 * Reads the key value from a process environment variable.
 * The `source` field of the key record contains the env var name.
 */
export function resolveFromEnv(source: string): string {
  if (!source) {
    throw new Error(
      '[KeyManager] Env provider requires an environment variable name in the "source" field.'
    );
  }

  const value = process.env[source];

  if (value === undefined) {
    throw new Error(
      `[KeyManager] Environment variable "${source}" is not set.`
    );
  }

  return value;
}
