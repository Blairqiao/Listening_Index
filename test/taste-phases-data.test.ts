import { test, mock } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { dbTest, useTestDatabase } from "./helpers/test-db";
import { getDb } from "../src/lib/db";
import { GET } from "../src/app/api/listening/taste/route";
import { getMockTaste } from "../src/lib/mock/taste-data";
import { CATALOG } from "../src/lib/mock/catalog";
import { getTastePhasesData, getWeeklyArtistCounts } from "../src/lib/db/queries";
import { clearServerCache, clearTasteCache, getOrFetchTaste, TASTE_CACHE_TTL_MS } from "../src/lib/db/server-cache";
import { assertTasteInvariants } from "./helpers/taste-scenarios";
import type { TastePhasesData } from "../src/lib/taste/types";

test("Taste route in mock mode returns 200 with kFine > 1, gradual shift, and invariants", async () => {
  const tz = "Asia/Kolkata";
  const req = new NextRequest(`http://127.0.0.1:8888/api/listening/taste?tz=${tz}`);
  const res = await GET(req);

  assert.equal(res.status, 200);
  assert.match(res.headers.get("cache-control") ?? "", /no-store/);

  const data = (await res.json()) as TastePhasesData;
  assertTasteInvariants(data);
  assert.equal(
    data.timezone,
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions().timeZone
  );
  assert.ok(data.kFine > 1, `expected kFine > 1, got ${data.kFine}`);
  assert.ok(data.kEra > 1, `expected kEra > 1, got ${data.kEra}`);
  assert.ok(
    data.shifts.some((s) => s.levels.some((l) => l.kind === "gradual")),
    "expected at least one gradual Taste Shift in mock data"
  );
  assert.ok(
    data.shifts.some((s) => s.levels.some((l) => l.kind === "sharp")),
    "expected at least one sharp Taste Shift in mock data"
  );
});

test("getMockTaste is deterministic and uses Catalog Artist names", () => {
  const fixedNow = new Date("2026-11-23T15:00:00Z");
  const t1 = getMockTaste("America/Chicago", fixedNow);
  const t2 = getMockTaste("America/Chicago", fixedNow);

  assert.deepEqual(t1, t2);
  assertTasteInvariants(t1);
  assert.equal(t1.timezone, "America/Chicago");
  assert.ok(t1.kFine > 1);
  assert.ok(t1.shifts.some((s) => s.levels.some((l) => l.kind === "gradual")));

  const catalogArtists = new Set(Object.values(CATALOG).map((entry) => entry.artist));
  for (const phase of t1.phases) {
    for (const artist of phase.topArtists) {
      assert.ok(
        catalogArtists.has(artist.name),
        `unexpected mock Artist name: ${artist.name}`
      );
    }
  }
});

test("getOrFetchTaste caches by timezone identity, outlives a sync, and clears on clearTasteCache", async () => {
  clearTasteCache();
  let fetchCount = 0;

  const makePayload = (tz: string): TastePhasesData => ({
    timezone: tz,
    analyzedWeeks: 0,
    kFine: 1,
    kEra: 1,
    phases: [],
    shifts: [],
    gaps: [],
  });

  const res1 = await getOrFetchTaste("America/Chicago", async () => {
    fetchCount++;
    return makePayload("America/Chicago");
  });
  const res2 = await getOrFetchTaste("America/Chicago", async () => {
    fetchCount++;
    return makePayload("America/Chicago");
  });
  assert.equal(fetchCount, 1);
  assert.deepEqual(res1, res2);

  await getOrFetchTaste("UTC", async () => {
    fetchCount++;
    return makePayload("UTC");
  });
  assert.equal(fetchCount, 2);

  clearServerCache();
  await getOrFetchTaste("America/Chicago", async () => {
    fetchCount++;
    return makePayload("America/Chicago");
  });
  assert.equal(fetchCount, 2, "a sync does not recompute Taste");

  clearTasteCache();
  await getOrFetchTaste("America/Chicago", async () => {
    fetchCount++;
    return makePayload("America/Chicago");
  });
  assert.equal(fetchCount, 3, "a history upload does");
});

test("getOrFetchTaste keeps a result for a day", async () => {
  mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  try {
    clearTasteCache();
    assert.equal(TASTE_CACHE_TTL_MS, 24 * 60 * 60 * 1000);
    let fetchCount = 0;
    const fetcher = async (): Promise<TastePhasesData> => {
      fetchCount++;
      return { timezone: "UTC", analyzedWeeks: 0, kFine: 1, kEra: 1, phases: [], shifts: [], gaps: [] };
    };
    await getOrFetchTaste("UTC", fetcher);
    mock.timers.tick(TASTE_CACHE_TTL_MS - 1);
    await getOrFetchTaste("UTC", fetcher);
    assert.equal(fetchCount, 1, "still cached just under a day later");
    mock.timers.tick(1);
    await getOrFetchTaste("UTC", fetcher);
    assert.equal(fetchCount, 2, "recomputed once the day is up");
  } finally {
    mock.timers.reset();
    clearTasteCache();
  }
});

test("getWeeklyArtistCounts buckets Plays by Sunday in request timezone", dbTest, async (t) => {
  clearServerCache();
  await useTestDatabase();
  const sql = getDb();

  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const fixtureTrackId = randomUUID().replaceAll("-", "").slice(0, 22);
  const fixtureArtistName = `Taste Fixture Artist ${suffix}`;
  const fixtureArtistKey = fixtureArtistName.toLowerCase();

  t.after(async () => {
    await sql`DELETE FROM plays WHERE track_id = ${fixtureTrackId}`;
    await sql`DELETE FROM tracks WHERE id = ${fixtureTrackId}`;
    clearServerCache();
  });

  await sql`
    INSERT INTO tracks (id, name, artist_name, album_name, artist_group_key, duration_ms, enrichment_status)
    VALUES (${fixtureTrackId}, 'Taste Fixture Track', ${fixtureArtistName}, 'Taste Fixture Album', ${fixtureArtistKey}, 180000, 'enriched')
  `;

  await sql`
    INSERT INTO plays (played_at, track_id, ms_played)
    VALUES
      ('2026-03-08T02:00:00Z'::timestamptz, ${fixtureTrackId}, 180000),
      ('2026-03-08T09:00:00Z'::timestamptz, ${fixtureTrackId}, 180000)
  `;

  const laRows = (await getWeeklyArtistCounts("America/Los_Angeles")).filter(
    (r) => r.artistKey === fixtureArtistKey
  );
  assert.deepEqual(laRows, [
    {
      week: "2026-03-01",
      artistKey: fixtureArtistKey,
      artistName: fixtureArtistName,
      plays: 1,
    },
    {
      week: "2026-03-08",
      artistKey: fixtureArtistKey,
      artistName: fixtureArtistName,
      plays: 1,
    },
  ]);

  const utcRows = (await getWeeklyArtistCounts("UTC")).filter(
    (r) => r.artistKey === fixtureArtistKey
  );
  assert.deepEqual(utcRows, [
    {
      week: "2026-03-08",
      artistKey: fixtureArtistKey,
      artistName: fixtureArtistName,
      plays: 2,
    },
  ]);

  const fullData = await getTastePhasesData("UTC");
  assertTasteInvariants(fullData);
});
