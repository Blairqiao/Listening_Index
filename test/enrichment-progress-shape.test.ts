import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';

// Delisted Tracks are deleted, so a delisted count can never be non-zero.
test('getEnrichmentProgress reports pending, enriched and total only', async () => {
  const sql = async () => [{ pending: 2, enriched: 3, total: 5 }];
  const mod = loadTs('src/lib/db/queries/enrichment.ts', {
    '../index': { getDb: () => sql },
    './schema': { ensureTablesExist: async () => undefined },
    './ingestion': {},
    './cache': { catalogStatusCache: {} },
  });
  assert.deepEqual(await mod.getEnrichmentProgress(), { pending: 2, enriched: 3, total: 5 });
});
