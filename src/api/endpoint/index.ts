/**
 * Key Manager Endpoint
 * Mounts at /km and provides REST routes for CRUD operations and key retrieval.
 *
 * Routes (all require admin authentication):
 *   GET    /km/keys              → list all keys (no values exposed)
 *   POST   /km/keys              → create a new key
 *   PATCH  /km/keys/:id          → update a key
 *   DELETE /km/keys/:id          → delete a key
 *   GET    /km/retrieve/:name    → resolve and return the actual secret value
 */
import { defineEndpoint } from '@directus/extensions-sdk';
import { v4 as uuidv4 } from 'uuid';
import { encryptValue } from '../providers/database.js';
import { getKey } from '../providers/index.js';

export default defineEndpoint({
  id: 'km',
  handler: (router, { database, logger }) => {
    // ── Middleware: require admin ──────────────────────────────────────────────
    const requireAdmin = (req: any, res: any, next: any) => {
      const user = req.accountability;
      if (!user || user.admin !== true) {
        return res.status(403).json({
          errors: [{ message: 'Forbidden: admin access required.', extensions: { code: 'FORBIDDEN' } }],
        });
      }
      next();
    };

    router.use(requireAdmin);

    // ── GET /km/keys ──────────────────────────────────────────────────────────
    router.get('/keys', async (_req: any, res: any) => {
      try {
        const rows = await database('directus_keys').select(
          'id', 'name', 'provider', 'source', 'description',
          'date_created', 'date_updated'
          // Note: 'value' intentionally omitted — never expose encrypted blob
        );
        res.json({ data: rows });
      } catch (err: any) {
        logger.error('[KeyManager] GET /km/keys error:', err);
        res.status(500).json({ errors: [{ message: err.message }] });
      }
    });

    // ── POST /km/keys ─────────────────────────────────────────────────────────
    router.post('/keys', async (req: any, res: any) => {
      const { name, provider, value, source, description } = req.body ?? {};

      if (!name || !provider) {
        return res.status(400).json({
          errors: [{ message: '"name" and "provider" are required.' }],
        });
      }

      if (provider === 'database' && !value) {
        return res.status(400).json({
          errors: [{ message: '"value" is required for the database provider.' }],
        });
      }

      if (['file', 'env', 'external'].includes(provider) && !source) {
        return res.status(400).json({
          errors: [{ message: '"source" is required for file/env/external providers.' }],
        });
      }

      try {
        const id = uuidv4();
        const encryptedValue = provider === 'database' ? encryptValue(value) : null;

        await database('directus_keys').insert({
          id,
          name,
          provider,
          value: encryptedValue,
          source: provider !== 'database' ? source : null,
          description: description ?? null,
        });

        res.status(201).json({ data: { id, name, provider, description } });
      } catch (err: any) {
        logger.error('[KeyManager] POST /km/keys error:', err);
        const isDuplicate = err.message?.includes('UNIQUE');
        res.status(isDuplicate ? 409 : 500).json({
          errors: [{ message: isDuplicate ? `Key "${name}" already exists.` : err.message }],
        });
      }
    });

    // ── PATCH /km/keys/:id ────────────────────────────────────────────────────
    router.patch('/keys/:id', async (req: any, res: any) => {
      const { id } = req.params;
      const { value, source, description, provider } = req.body ?? {};

      try {
        const existing = await database('directus_keys').where({ id }).first();
        if (!existing) {
          return res.status(404).json({ errors: [{ message: 'Key not found.' }] });
        }

        const updates: Record<string, any> = { date_updated: new Date() };

        if (description !== undefined) updates.description = description;
        if (provider !== undefined) updates.provider = provider;

        const resolvedProvider = provider ?? existing.provider;
        if (resolvedProvider === 'database' && value) {
          updates.value = encryptValue(value);
          updates.source = null;
        } else if (source !== undefined) {
          updates.source = source;
          updates.value = null;
        }

        await database('directus_keys').where({ id }).update(updates);
        res.json({ data: { id, ...updates } });
      } catch (err: any) {
        logger.error('[KeyManager] PATCH /km/keys/:id error:', err);
        res.status(500).json({ errors: [{ message: err.message }] });
      }
    });

    // ── DELETE /km/keys/:id ───────────────────────────────────────────────────
    router.delete('/keys/:id', async (req: any, res: any) => {
      const { id } = req.params;

      try {
        const deleted = await database('directus_keys').where({ id }).delete();
        if (!deleted) {
          return res.status(404).json({ errors: [{ message: 'Key not found.' }] });
        }
        res.json({ data: { id } });
      } catch (err: any) {
        logger.error('[KeyManager] DELETE /km/keys/:id error:', err);
        res.status(500).json({ errors: [{ message: err.message }] });
      }
    });

    // ── GET /km/retrieve/:name ────────────────────────────────────────────────
    router.get('/retrieve/:name', async (req: any, res: any) => {
      const { name } = req.params;

      try {
        const value = await getKey(name, database);
        res.json({ data: { name, value } });
      } catch (err: any) {
        logger.error(`[KeyManager] GET /km/retrieve/${name} error:`, err);
        const isNotFound = err.message?.includes('not found');
        res.status(isNotFound ? 404 : 500).json({
          errors: [{ message: err.message }],
        });
      }
    });
  },
});
