import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';

// "Beyoncé" with a decomposed é (e + U+0301). Ingestion stores the NFC form.
const DECOMPOSED_ARTIST = 'Beyoncé';
const STORED_GROUP_KEY = 'beyoncé';

test('track stats matches artist Group Key the way ingestion builds it (NFC)', async () => {
  const groupKeysQueried: unknown[] = [];

  const sql = async (strings: TemplateStringsArray, ...vals: unknown[]) => {
    const text = strings.join('?');
    if (text.includes('t.artist_group_key = ?')) {
      groupKeysQueried.push(...vals.filter((v) => typeof v === 'string'));
      const matches = vals.includes(STORED_GROUP_KEY);
      if (text.includes('lower(trim(t.name))')) return [];
      return [{ plays: matches ? 7 : 0, rank: 1 }];
    }
    return [{ rank: 1, total_tracks: 1, total_artists: 1 }];
  };

  const mod = loadTs('src/lib/db/queries/track-stats.ts', {
    '../index': { getDb: () => sql, isDbConfigured: () => true },
    './cache': { catalogTotalsCache: { get: (fn: () => unknown) => fn() } },
    './enrichment': { isCatalogFullyEnriched: async () => false },
  });

  const stats = await mod.getTrackTelemetryStats({ title: 'Halo', artist: DECOMPOSED_ARTIST });

  assert.equal(stats.artist.plays, 7, `artist plays must match stored key; queried ${JSON.stringify(groupKeysQueried)}`);
});
