import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadTs } from './helpers/load-ts';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

test('schema setup no longer runs on the request path', () => {
  const offenders = sourceFiles('src').filter((file) => fs.readFileSync(file, 'utf8').includes('ensureTablesExist'));
  assert.deepEqual(offenders, []);
});

test('build and dev run the migration script before Next', () => {
  const { scripts } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.match(scripts.build, /^tsx scripts\/migrate\.ts && next build/);
  assert.match(scripts.dev, /^tsx scripts\/migrate\.ts && next dev/);
  assert.equal(scripts['db:migrate'], 'tsx scripts/migrate.ts');
});

test('migrations run locally and for Vercel production, never for Preview builds', () => {
  const { shouldRunMigrations } = loadTs('src/lib/db/queries/schema.ts', {
    '../index': { getDb: () => undefined, isDbConfigured: () => true },
  });
  assert.equal(shouldRunMigrations({}), true);
  assert.equal(shouldRunMigrations({ VERCEL_ENV: 'production' }), true);
  assert.equal(shouldRunMigrations({ VERCEL_ENV: 'preview' }), false);
  assert.equal(shouldRunMigrations({ VERCEL_ENV: 'development' }), false);
});

test('migrateSchema sends idempotent DDL only, with no data-deleting migration', async () => {
  const statements: string[] = [];
  const sql = async (strings: TemplateStringsArray) => { statements.push(strings.join('?')); return []; };
  const { migrateSchema } = loadTs('src/lib/db/queries/schema.ts', {
    '../index': { getDb: () => sql, isDbConfigured: () => true },
  });
  await migrateSchema();
  assert.equal(statements.length, 1);
  assert.ok(statements[0].includes('CREATE TABLE IF NOT EXISTS plays'));
  assert.ok(!/DELETE\s+FROM/i.test(statements[0]), 'no row deletes in schema setup');
});

test('migrateSchema adds the three stored search columns', async () => {
  const statements: string[] = [];
  const sql = async (strings: TemplateStringsArray) => { statements.push(strings.join('?')); return []; };
  const { migrateSchema } = loadTs('src/lib/db/queries/schema.ts', {
    '../index': { getDb: () => sql, isDbConfigured: () => true },
  });
  await migrateSchema();
  const ddl = statements.join('\n');
  for (const column of ['name_search', 'artist_name_search']) {
    assert.match(ddl, new RegExp(`ADD COLUMN IF NOT EXISTS ${column} TEXT\\s+GENERATED ALWAYS AS \\(lower\\(regexp_replace\\(normalize\\(\\w+, NFKD\\)[^]*?\\) STORED`));
  }
  assert.match(ddl, /ALTER TABLE artists\s+ADD COLUMN IF NOT EXISTS name_search TEXT\s+GENERATED ALWAYS[^]*?STORED/);
  assert.match(ddl, /ALTER TABLE tracks\s+ADD COLUMN IF NOT EXISTS name_search TEXT/);
});
