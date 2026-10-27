import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { neon, neonConfig } from '@neondatabase/serverless';
import {
  rotateOwnerPlaybackToken, deleteOwnerPlaybackToken, saveOwnerPlaybackToken,
  beginOwnerAuthorization, consumeOwnerAuthorization,
} from '../src/lib/db/queries/config';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

test('PostgreSQL rejects stale credential writes across disconnect/replacement and consumes OAuth once', { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  const fingerprint = createHash('sha256').update(new URL(databaseUrl).host + '/' + new URL(databaseUrl).pathname).digest('hex').slice(0, 16);
  console.log(`Credential SQL fixture target fingerprint ${fingerprint}; transaction-local temporary table only.`);
  const originalFetch = neonConfig.fetchFunction;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const queries: { query: string; params: string[] }[] = [];
  process.env.DATABASE_URL = 'postgresql://mock:mock@secondary.example/mock';
  neonConfig.fetchFunction = async (_url: unknown, init?: RequestInit) => {
    const payload = JSON.parse(String(init?.body));
    queries.push(payload);
    return Response.json({ fields: [{ name: 'owner_token_revision', dataTypeID: 25 }], rows: [['8']] });
  };
  try {
    await rotateOwnerPlaybackToken('8', 'old', 'rotated');
    await deleteOwnerPlaybackToken();
    await saveOwnerPlaybackToken('replacement', 'Replacement');
    await saveOwnerPlaybackToken('late-callback', null, null, '8');
    await beginOwnerAuthorization('nonce');
    await consumeOwnerAuthorization('nonce', '10');
  } finally {
    neonConfig.fetchFunction = originalFetch;
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
  const rotate = queries.find(q => q.query.includes('AND owner_playback_token ='))!;
  const disconnect = queries.find(q => q.query.includes('SET owner_playback_token = NULL'))!;
  const replace = queries.find(q => q.query.includes('EXCLUDED.owner_playback_token'))!;
  const lateCallback = queries.find(q => q.query.includes('owner_playback_token = $1') && q.query.includes('owner_spotify_name ='))!;
  const begin = queries.find(q => q.query.includes('EXCLUDED.owner_oauth_nonce'))!;
  const consume = queries.find(q => q.query.includes('AND owner_oauth_nonce ='))!;
  for (const query of [rotate, disconnect, replace, lateCallback, begin, consume]) assert.ok(query);
  const sql = neon(databaseUrl);
  const results = await sql.transaction([
    sql`CREATE TEMP TABLE site_settings (
      id TEXT PRIMARY KEY, title TEXT, owner_name TEXT, accent_color TEXT, site_url TEXT, github_url TEXT, timezone TEXT,
      owner_playback_token TEXT, owner_spotify_name TEXT, owner_spotify_url TEXT, owner_token_updated_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ, owner_token_revision BIGINT NOT NULL DEFAULT 0, owner_oauth_nonce TEXT
    ) ON COMMIT DROP`,
    sql`INSERT INTO pg_temp.site_settings (id, owner_playback_token, owner_token_revision) VALUES ('active', 'old', 8)`,
    sql.query(rotate.query, rotate.params),
    sql.query(rotate.query, rotate.params),
    sql.query(disconnect.query, disconnect.params),
    sql.query(rotate.query, rotate.params),
    sql.query(replace.query, replace.params),
    sql.query(rotate.query, rotate.params),
    sql.query(lateCallback.query, lateCallback.params),
    sql.query(begin.query, begin.params),
    sql.query(consume.query, consume.params),
    sql.query(consume.query, consume.params),
    sql`SELECT owner_playback_token, owner_token_revision, owner_oauth_nonce FROM pg_temp.site_settings WHERE id = 'active'`,
  ]);
  assert.deepEqual(results[2], [{ owner_token_revision: '8' }]);
  for (const index of [3, 5, 7, 8, 11]) assert.deepEqual(results[index], [], `stale write at step ${index} must affect no row`);
  assert.deepEqual(results[9], [{ owner_token_revision: '10' }]);
  assert.deepEqual(results[10], [{ owner_token_revision: '10' }]);
  assert.deepEqual(results[12], [{ owner_playback_token: 'replacement', owner_token_revision: '10', owner_oauth_nonce: null }]);
});
