/**
 * Key Manager Hook
 * Runs on Directus startup and ensures the `directus_keys` table exists.
 * Also demonstrates the getKey() helper in action.
 */
import { defineHook } from '@directus/extensions-sdk';

export default defineHook(({ init }, { database, logger }) => {
  init('app.after', async () => {
    logger.info('[KeyManager] Initializing — checking directus_keys schema...');

    const hasTable = await database.schema.hasTable('directus_keys');

    if (!hasTable) {
      logger.info('[KeyManager] Creating directus_keys table...');

      await database.schema.createTable('directus_keys', (table) => {
        table.uuid('id').primary().defaultTo(database.raw('(lower(hex(randomblob(4))) || \'-\' || lower(hex(randomblob(2))) || \'-4\' || substr(lower(hex(randomblob(2))),2) || \'-\' || substr(\'89ab\',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || \'-\' || lower(hex(randomblob(6))))'));
        table.string('name', 255).notNullable().unique();
        table.enum('provider', ['database', 'file', 'env', 'external']).notNullable().defaultTo('database');
        table.text('value').nullable();      // encrypted value (database provider)
        table.text('source').nullable();     // file path / env var name / URL
        table.text('description').nullable();
        table.timestamp('date_created').defaultTo(database.fn.now());
        table.timestamp('date_updated').defaultTo(database.fn.now());
      });

      logger.info('[KeyManager] directus_keys table created successfully.');
    } else {
      logger.info('[KeyManager] directus_keys table already exists — skipping creation.');
    }
  });
});
