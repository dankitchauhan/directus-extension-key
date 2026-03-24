/**
 * External Provider
 * Fetches the key value via HTTP from an external secret manager
 * (e.g., HashiCorp Vault, AWS Secrets Manager compatible endpoint).
 *
 * The `source` field contains the URL.
 * Optional: set KM_EXTERNAL_TOKEN env var to send a Bearer token.
 *
 * Expected response: JSON with a top-level "value", "data", or "secret" field,
 * or a plain text body.
 */

export async function resolveFromExternal(source: string): Promise<string> {
  if (!source) {
    throw new Error(
      '[KeyManager] External provider requires a URL in the "source" field.'
    );
  }

  const token = process.env['KM_EXTERNAL_TOKEN'];
  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(source, { headers });
  } catch (err: any) {
    throw new Error(
      `[KeyManager] External provider HTTP request to "${source}" failed: ${err.message}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `[KeyManager] External provider returned HTTP ${response.status} for "${source}".`
    );
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    const json: any = await response.json();
    // Support common response shapes
    const value =
      json?.value ??
      json?.data?.value ??    // Vault KV v2
      json?.secret ??
      json?.SecretString ??   // AWS Secrets Manager
      null;

    if (value === null || value === undefined) {
      throw new Error(
        `[KeyManager] External provider response from "${source}" has no recognizable value field.`
      );
    }
    return String(value);
  }

  // Plain text fallback
  return (await response.text()).trim();
}
