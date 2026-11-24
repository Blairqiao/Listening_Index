import { test } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { localDateKey } from "../src/lib/range";
import { dbTest, useTestDatabase } from "./helpers/test-db";
import { getDb } from "../src/lib/db";
import { GET } from "../src/app/api/listening/calendar/route";
import { getMockCalendar } from "../src/lib/mock/calendar-data";
import { getCalendarData } from "../src/lib/db/queries";
import { getOrFetchCalendar, clearServerCache } from "../src/lib/db/server-cache";
import type { CalendarData } from "../src/lib/calendar";

test("Calendar route in mock mode returns 200 and valid CalendarData", async () => {
  const tz = "Asia/Kolkata";
  const req = new NextRequest(`http://127.0.0.1:8888/api/listening/calendar?tz=${tz}`);
  const res = await GET(req);

  assert.equal(res.status, 200);
  const data = (await res.json()) as CalendarData;

  assert.ok(Array.isArray(data.days), "days must be an array");
  assert.ok(data.days.length > 0, "days must not be empty");

  // Every count >= 1
  for (const day of data.days) {
    assert.ok(day.count >= 1, `count for ${day.date} must be >= 1, got ${day.count}`);
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/, "date must match YYYY-MM-DD");
  }

  // Days are strictly ascending
  for (let i = 1; i < data.days.length; i++) {
    assert.ok(
      data.days[i - 1].date < data.days[i].date,
      `days must be ascending: ${data.days[i - 1].date} < ${data.days[i].date}`
    );
  }

  assert.equal(data.firstDate, data.days[0].date);
  assert.equal(data.today, localDateKey(new Date(), tz));
  assert.equal(
    data.timezone,
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions().timeZone
  );
});

test("getMockCalendar produces deterministic CalendarData from 2024-01-01 to today", () => {
  const tz = "America/Chicago";
  const fixedNow = new Date("2026-11-23T15:00:00Z");
  const cal1 = getMockCalendar(tz, fixedNow);
  const cal2 = getMockCalendar(tz, fixedNow);

  assert.deepEqual(cal1, cal2, "getMockCalendar must be deterministic for identical arguments");
  assert.equal(cal1.today, localDateKey(fixedNow, tz));
  assert.equal(cal1.firstDate, cal1.days[0]?.date ?? null);
  assert.ok(cal1.days.length > 0);
  assert.ok(cal1.days[0].date >= "2024-01-01");
  assert.ok(cal1.days[cal1.days.length - 1].date <= cal1.today);

  for (const day of cal1.days) {
    assert.ok(day.count >= 1);
  }
});

test("getOrFetchCalendar caches by timezone identity and invalidates on clearServerCache", async () => {
  clearServerCache();
  let fetchCount = 0;
  const mockFetcher = async (): Promise<CalendarData> => {
    fetchCount++;
    return {
      days: [{ date: "2026-01-01", count: 10 }],
      firstDate: "2026-01-01",
      today: "2026-01-02",
      timezone: "America/Chicago",
    };
  };

  const res1 = await getOrFetchCalendar("America/Chicago", mockFetcher);
  const res2 = await getOrFetchCalendar("America/Chicago", mockFetcher);
  assert.equal(fetchCount, 1, "second call should hit cache");
  assert.deepEqual(res1, res2);

  // Different timezone identity triggers fetch
  const res3 = await getOrFetchCalendar("UTC", mockFetcher);
  assert.equal(fetchCount, 2, "different timezone should not hit cache");
  assert.deepEqual(res3.days, [{ date: "2026-01-01", count: 10 }]);

  // Cache clear invalidates
  clearServerCache();
  await getOrFetchCalendar("America/Chicago", mockFetcher);
  assert.equal(fetchCount, 3, "call after clearServerCache should fetch again");
});

test("getCalendarData db query oracle", dbTest, async (t) => {
  await useTestDatabase();
  const sql = getDb();

  // 1. Capture baseline counts before insert
  const baselineChicago = await getCalendarData("America/Chicago");
  const baselineUtc = await getCalendarData("UTC");
  const baseChicagoMap = new Map(baselineChicago.days.map((d) => [d.date, d.count]));
  const baseUtcMap = new Map(baselineUtc.days.map((d) => [d.date, d.count]));

  // 2. Insert unique fixture Track and three Plays
  const fixtureTrackId = randomUUID().replaceAll("-", "").slice(0, 22);

  t.after(async () => {
    await sql`DELETE FROM plays WHERE track_id = ${fixtureTrackId}`;
    await sql`DELETE FROM tracks WHERE id = ${fixtureTrackId}`;
  });

  await sql`
    INSERT INTO tracks (id, name, artist_name, album_name, duration_ms, enrichment_status)
    VALUES (${fixtureTrackId}, 'Calendar Fixture Track', 'Fixture Artist', 'Fixture Album', 180000, 'enriched')
  `;

  // 2026-03-08T05:30:00Z and 2026-03-08T06:30:00Z (in America/Chicago: 2026-03-07 23:30 CST and 2026-03-08 00:30 CST)
  // 2026-03-09T12:00:00Z (in America/Chicago: 2026-03-09 07:00 CDT, in UTC: 2026-03-09 12:00)
  await sql`
    INSERT INTO plays (played_at, track_id, ms_played)
    VALUES
      ('2026-03-08T05:30:00Z'::timestamptz, ${fixtureTrackId}, 180000),
      ('2026-03-08T06:30:00Z'::timestamptz, ${fixtureTrackId}, 180000),
      ('2026-03-09T12:00:00Z'::timestamptz, ${fixtureTrackId}, 180000)
  `;

  // 3. Query after insert
  const afterChicago = await getCalendarData("America/Chicago");
  const afterUtc = await getCalendarData("UTC");
  const afterChicagoMap = new Map(afterChicago.days.map((d) => [d.date, d.count]));
  const afterUtcMap = new Map(afterUtc.days.map((d) => [d.date, d.count]));

  const targetDates = ["2026-03-07", "2026-03-08", "2026-03-09"];

  // In America/Chicago:
  // 2026-03-07: +1
  // 2026-03-08: +1
  // 2026-03-09: +1
  const deltaChicago = targetDates
    .map((date) => ({
      date,
      count: (afterChicagoMap.get(date) ?? 0) - (baseChicagoMap.get(date) ?? 0),
    }))
    .filter((d) => d.count > 0);

  assert.deepEqual(deltaChicago, [
    { date: "2026-03-07", count: 1 },
    { date: "2026-03-08", count: 1 },
    { date: "2026-03-09", count: 1 },
  ]);

  // In UTC:
  // 2026-03-07: 0
  // 2026-03-08: +2
  // 2026-03-09: +1
  const deltaUtc = targetDates
    .map((date) => ({
      date,
      count: (afterUtcMap.get(date) ?? 0) - (baseUtcMap.get(date) ?? 0),
    }))
    .filter((d) => d.count > 0);

  assert.deepEqual(deltaUtc, [
    { date: "2026-03-08", count: 2 },
    { date: "2026-03-09", count: 1 },
  ]);
});
