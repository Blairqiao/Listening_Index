import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './helpers/load-ts';

interface StoredPlay {
  id: number;
  track_id: string;
  played_at: Date;
  ms_played: number;
}

function createMockDb(initialPlays: StoredPlay[] = []) {
  const plays: StoredPlay[] = [...initialPlays];
  let nextId = plays.length + 1;
  const activeLocks = new Set<string>();
  const statements: string[] = [];
  const transactions: string[][] = [];

  const sql = async (strings: TemplateStringsArray, ...vals: unknown[]) => {
    const text = strings.join('?').trim();
    statements.push(text);

    // Atomic CTE / single-statement handling with advisory lock simulation
    if (text.includes('WITH locked AS') || text.includes('INSERT INTO plays')) {
      let playedAts: string[];
      let trackIds: string[];
      let msPlayeds: number[];

      if (vals.length >= 4) {
        playedAts = vals[1] as string[];
        trackIds = vals[2] as string[];
        msPlayeds = vals[3] as number[];
      } else {
        playedAts = vals[0] as string[];
        trackIds = vals[1] as string[];
        msPlayeds = vals[2] as number[];
      }

      // Simulate pg_advisory_xact_lock on sorted track IDs
      const sortedDistinctTracks = Array.from(new Set(trackIds)).sort();
      for (const t of sortedDistinctTracks) {
        while (activeLocks.has(t)) {
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
        activeLocks.add(t);
      }

      let insertedCount = 0;
      try {
        for (let i = 0; i < playedAts.length; i++) {
          const pAt = new Date(playedAts[i]);
          const pTime = pAt.getTime();
          const tId = trackIds[i];
          const ms = Number(msPlayeds[i]) || 0;

          // Symmetrically match existing plays within cooldown window
          const match = plays.find((p) => {
            if (p.track_id !== tId) return false;
            if (p.played_at.toISOString().slice(0, 19) === pAt.toISOString().slice(0, 19)) {
              return true;
            }
            const cooldown = Math.max(30000, Math.round(Math.max(p.ms_played, ms) * 0.90));
            return Math.abs(p.played_at.getTime() - pTime) < cooldown;
          });

          if (match) {
            match.ms_played = Math.max(match.ms_played, ms);
          } else {
            plays.push({
              id: nextId++,
              track_id: tId,
              played_at: pAt,
              ms_played: ms,
            });
            insertedCount++;
          }
        }
      } finally {
        for (const t of sortedDistinctTracks) {
          activeLocks.delete(t);
        }
      }

      return [{ inserted_count: insertedCount }];
    }

    // SELECT existing recent plays
    if (text.includes('SELECT') && text.includes('FROM plays')) {
      const trackIds = vals[0] as string[];
      const minTime = new Date(vals[1] as string).getTime();
      const maxTime = new Date(vals[2] as string).getTime();

      return plays.filter((p) => {
        const t = p.played_at.getTime();
        return trackIds.includes(p.track_id) && t >= minTime && t <= maxTime;
      }).map((p) => ({
        id: p.id,
        track_id: p.track_id,
        played_at: p.played_at,
        ms_played: p.ms_played,
      }));
    }

    return [];
  };

  // Records which statements were sent together as one transaction.
  const transaction = async (queries: Promise<unknown>[]) => {
    transactions.push(statements.slice(-queries.length));
    const results: unknown[] = [];
    for (const q of queries) results.push(await q);
    return results;
  };

  return { sql: Object.assign(sql, { transaction }), plays, transactions };
}

test('N001: overlapping import does not insert near-duplicate plays when multiple occurrences exist', async () => {
  const initial: StoredPlay[] = [
    {
      id: 1,
      track_id: 'track-overlap-1',
      played_at: new Date('2026-10-26T00:00:00.000Z'),
      ms_played: 30_000,
    },
    {
      id: 2,
      track_id: 'track-overlap-1',
      played_at: new Date('2026-10-26T00:05:00.000Z'),
      ms_played: 30_000,
    },
  ];

  const { sql, plays } = createMockDb(initial);

  const ingestionModule = loadTs('src/lib/db/queries/ingestion.ts', {
    '../index': { getDb: () => sql },
    './cache': { syncCache: { set: () => undefined } },
    '@/lib/db/server-cache': { clearServerCache: () => undefined },
  });

  // Candidate batch contains 00:00:20 (20s after first play, <30s cooldown) and exact 00:05:00
  const candidateBatch = [
    { trackId: 'track-overlap-1', playedAt: '2026-10-26T00:00:20.000Z', msPlayed: 30_000 },
    { trackId: 'track-overlap-1', playedAt: '2026-10-26T00:05:00.000Z', msPlayed: 30_000 },
  ];

  const result = await ingestionModule.bulkInsertPlays(candidateBatch);

  assert.equal(result.insertedCount, 0, 'No new plays should be inserted for overlapping batch');
  assert.equal(plays.length, 2, 'Total plays in database must remain 2, not 3');

  const timestamps = plays.map((p) => p.played_at.toISOString());
  assert.ok(!timestamps.includes('2026-10-26T00:00:20.000Z'), 'Near-duplicate at 00:00:20 must not be inserted');
});

test('N002: cross-batch near duplicate merges greater duration into stored play', async () => {
  const initial: StoredPlay[] = [
    {
      id: 1,
      track_id: 'track-duration-1',
      played_at: new Date('2026-10-26T00:00:00.000Z'),
      ms_played: 30_000,
    },
  ];

  const { sql, plays } = createMockDb(initial);

  const ingestionModule = loadTs('src/lib/db/queries/ingestion.ts', {
    '../index': { getDb: () => sql },
    './cache': { syncCache: { set: () => undefined } },
    '@/lib/db/server-cache': { clearServerCache: () => undefined },
  });

  // Later batch contains near-duplicate at 00:00:20 with greater duration (60,000ms)
  const candidateBatch = [
    { trackId: 'track-duration-1', playedAt: '2026-10-26T00:00:20.000Z', msPlayed: 60_000 },
  ];

  const result = await ingestionModule.bulkInsertPlays(candidateBatch);

  assert.equal(result.insertedCount, 0, 'Near duplicate must not be inserted as a new play');
  assert.equal(plays.length, 1, 'Total plays in database must remain 1');
  assert.equal(plays[0].ms_played, 60_000, 'Stored play duration must be updated to 60000ms');
});

test('N014: symmetric cooldown prevents near-duplicates when stored play duration is longer than incoming candidate', async () => {
  const initial: StoredPlay[] = [
    {
      id: 1,
      track_id: 'track-symmetric-1',
      played_at: new Date('2026-10-26T00:00:00.000Z'),
      ms_played: 200_000, // 200s duration, cooldown window = 180s
    },
  ];

  const { sql, plays } = createMockDb(initial);

  const ingestionModule = loadTs('src/lib/db/queries/ingestion.ts', {
    '../index': { getDb: () => sql },
    './cache': { syncCache: { set: () => undefined } },
    '@/lib/db/server-cache': { clearServerCache: () => undefined },
  });

  // Candidate is a 10s play 100s later (within 180s window of stored play)
  const candidateBatch = [
    { trackId: 'track-symmetric-1', playedAt: '2026-10-26T00:01:40.000Z', msPlayed: 10_000 },
  ];

  const result = await ingestionModule.bulkInsertPlays(candidateBatch);

  assert.equal(result.insertedCount, 0, 'Incoming play within stored play duration window must not be inserted');
  assert.equal(plays.length, 1, 'Total plays in database must remain 1');
});

test('N014: concurrent imports for the same track serialize and do not insert near-duplicates', async () => {
  const initial: StoredPlay[] = [];
  const { sql, plays } = createMockDb(initial);

  const ingestionModule = loadTs('src/lib/db/queries/ingestion.ts', {
    '../index': { getDb: () => sql },
    './cache': { syncCache: { set: () => undefined } },
    '@/lib/db/server-cache': { clearServerCache: () => undefined },
  });

  const batchA = [
    { trackId: 'track-concurrent-1', playedAt: '2026-10-26T00:00:00.000Z', msPlayed: 30_000 },
  ];
  const batchB = [
    { trackId: 'track-concurrent-1', playedAt: '2026-10-26T00:00:20.000Z', msPlayed: 30_000 },
  ];

  const [resA, resB] = await Promise.all([
    ingestionModule.bulkInsertPlays(batchA),
    ingestionModule.bulkInsertPlays(batchB),
  ]);

  const totalInserted = resA.insertedCount + resB.insertedCount;
  assert.equal(totalInserted, 1, 'Only one of the concurrent near-duplicates should be inserted');
  assert.equal(plays.length, 1, 'Total plays in database must remain 1');
});



test('N014: advisory lock runs as its own statement before the insert in one transaction', async () => {
  const { sql, transactions } = createMockDb([]);

  const ingestionModule = loadTs('src/lib/db/queries/ingestion.ts', {
    '../index': { getDb: () => sql },
    './cache': { syncCache: { set: () => undefined } },
    '@/lib/db/server-cache': { clearServerCache: () => undefined },
  });

  await ingestionModule.bulkInsertPlays([
    { trackId: 'track-lock-1', playedAt: '2026-10-26T00:00:00.000Z', msPlayed: 30_000 },
  ]);

  // A lock taken inside the insert statement does not refresh that statement's snapshot,
  // and Postgres skips unreferenced read-only CTEs. The lock must be a prior statement.
  assert.equal(transactions.length, 1, 'insert must run inside one transaction');
  const [lockStmt, insertStmt] = transactions[0];
  assert.ok(lockStmt.includes('pg_advisory_xact_lock'), 'first statement takes the advisory locks');
  assert.ok(insertStmt.includes('INSERT INTO plays'), 'second statement inserts');
  assert.ok(!insertStmt.includes('pg_advisory_xact_lock'), 'insert statement must not take the lock itself');
});
