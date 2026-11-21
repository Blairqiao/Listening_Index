import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildActivityCadence } from '../src/lib/db/queries/cadence';
import { formatCadenceTooltip } from '../src/lib/format-utils';

// ---------------------------------------------------------------------------
// N007: Repeated fall-back hour counted twice
// ---------------------------------------------------------------------------
test('N007: hourly cadence does not double count during DST fall-back transition', () => {
  const now = new Date('2026-11-01T15:00:00Z');
  const tz = 'America/Chicago';

  // In America/Chicago on 2026-11-01:
  // 06:10 UTC is 01:10 CDT (UTC-5)
  // 07:10 UTC is 01:10 CST (UTC-6)
  // Each hour contains 1 play. When grouped by absolute hour:
  const cadenceRows = [
    { hour_key: '2026-11-01T06:00:00Z', count: 1 },
    { hour_key: '2026-11-01T07:00:00Z', count: 1 },
  ];

  const { activityCadence } = buildActivityCadence({
    range: '1d',
    tz,
    now,
    cadenceRows,
  });

  const totalPlays = activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(totalPlays, 2, 'Total plays across 24 hours must be 2, not inflated to 4');

  // Verify start and end times for all buckets are distinct
  const startTimes = activityCadence.map((b) => b.startTime);
  const uniqueStartTimes = new Set(startTimes);
  assert.equal(uniqueStartTimes.size, startTimes.length, 'Bucket start times must all be distinct real instants');
});

// ---------------------------------------------------------------------------
// N008: Fixed 24-hour cadence steps across DST transitions
// ---------------------------------------------------------------------------
test('N008: spring-forward does not skip local calendar dates in 1w, 1m, and 6m', () => {
  const now = new Date('2026-03-09T05:30:00Z'); // Local 2026-03-09 00:30 in America/Chicago
  const tz = 'America/Chicago';

  // 1w test
  const wRows = [{ day: '2026-03-08', block: 0, count: 1 }];
  const wResult = buildActivityCadence({ range: '1w', tz, now, cadenceRows: wRows });
  const wTotal = wResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(wTotal, 1, '1w cadence must include March 8 play across spring-forward');

  // 1m test
  const mRows = [{ day: '2026-03-08', count: 1 }];
  const mResult = buildActivityCadence({ range: '1m', tz, now, cadenceRows: mRows });
  const mTotal = mResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(mTotal, 1, '1m cadence must include March 8 play across spring-forward');

  // 6m test
  const sRows = [{ day: '2026-03-08', count: 1 }];
  const sResult = buildActivityCadence({ range: '6m', tz, now, cadenceRows: sRows });
  const sTotal = sResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(sTotal, 1, '6m cadence must include March 8 play across spring-forward');
});

test('N008: fall-back does not repeat local calendar dates in 1w, 1m, and 6m', () => {
  const now = new Date('2026-11-02T05:30:00Z'); // Local 2026-11-01 23:30 in America/Chicago
  const tz = 'America/Chicago';

  // 1w test
  const wRows = [{ day: '2026-11-01', block: 0, count: 1 }];
  const wResult = buildActivityCadence({ range: '1w', tz, now, cadenceRows: wRows });
  const wTotal = wResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(wTotal, 1, '1w cadence must count Nov 1 exactly once');

  // 1m test
  const mRows = [{ day: '2026-11-01', count: 1 }];
  const mResult = buildActivityCadence({ range: '1m', tz, now, cadenceRows: mRows });
  const mTotal = mResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(mTotal, 1, '1m cadence must count Nov 1 exactly once');

  // 6m test
  const sRows = [{ day: '2026-11-01', count: 1 }];
  const sResult = buildActivityCadence({ range: '6m', tz, now, cadenceRows: sRows });
  const sTotal = sResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(sTotal, 1, '6m cadence must count Nov 1 exactly once');
});

// ---------------------------------------------------------------------------
// N009: Cadence window agreement with Overview range
// ---------------------------------------------------------------------------
test('N009: cadence buckets include plays in earliest partial bucket of rolling ranges', async () => {
  const now = new Date('2026-11-02T12:30:00Z');
  const tz = 'UTC';

  // 1d: play at 2026-11-01T12:45:00Z (23h45m ago, in 24h window)
  const dRows = [{ hour_key: '2026-11-01T12:00:00Z', count: 1 }];
  const dResult = buildActivityCadence({ range: '1d', tz, now, cadenceRows: dRows });
  const dTotal = dResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(dTotal, 1, '1d cadence must include play in earliest partial hour (yesterday 12:45)');

  // 1w: play at 2026-10-26T19:00:00Z (6d17h30m ago, in 7d window)
  const wRows = [{ day: '2026-10-26', block: 3, count: 1 }];
  const wResult = buildActivityCadence({ range: '1w', tz, now, cadenceRows: wRows });
  const wTotal = wResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(wTotal, 1, '1w cadence must include play in earliest partial day block (Oct 26 block 3)');

  // 1m: play at 2026-10-03T15:00:00Z (29d21h30m ago, in 30d window)
  const mRows = [{ day: '2026-10-03', count: 1 }];
  const mResult = buildActivityCadence({ range: '1m', tz, now, cadenceRows: mRows });
  const mTotal = mResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(mTotal, 1, '1m cadence must include play in earliest partial day (Oct 3)');

  // 1y: play at 2025-11-15T12:00:00Z (352d ago, in 365d window)
  const yRows = [{ ym: '2025-11', count: 1 }];
  const yResult = buildActivityCadence({ range: '1y', tz, now, cadenceRows: yRows });
  const yTotal = yResult.activityCadence.reduce((sum, b) => sum + b.count, 0);
  assert.equal(yTotal, 1, '1y cadence must include play in earliest partial month (Nov 2025)');

  // 6m: SQL query builder must query 180 days (aligning with Overview), not 182 days
  const { loadTs } = await import('./helpers/load-ts');
  const cadenceModule = loadTs('src/lib/db/queries/cadence.ts', {
    '../index': {
      getDb: () => (strings: TemplateStringsArray, ..._vals: unknown[]) => ({ strings: Array.from(strings) }),
    },
  });
  const sqlQuery6m = cadenceModule.buildCadenceQuery('6m', 'UTC');
  const queryText = (sqlQuery6m as unknown as { strings: string[] }).strings.join(' ');
  assert.ok(queryText.includes("180 days"), "6m query must use 180 days interval");
  assert.ok(!queryText.includes("182 days"), "6m query must not use 182 days interval");
});

// ---------------------------------------------------------------------------
// N013: Bar label and tooltip agreement across timezones
// ---------------------------------------------------------------------------
test('N013: 1d cadence bar label and tooltip agree in a non-UTC visitor timezone and other ranges unchanged', () => {
  const now = new Date('2026-11-03T15:20:00Z');
  const tz = 'America/New_York';
  const cadenceRows = [{ hour_key: '2026-11-03T14:00:00Z', count: 3 }];

  const { activityCadence } = buildActivityCadence({
    range: '1d',
    tz,
    now,
    cadenceRows,
  });

  const bucket = activityCadence.find((b) => b.count === 3);
  assert.ok(bucket, 'Target bucket with 3 plays must exist');
  assert.equal(bucket.date, '09:00', 'Bar label hour must be 09:00 in America/New_York');

  const tooltip1d = formatCadenceTooltip(bucket, '1d', tz);
  const tooltipHour = tooltip1d.slice(0, 5);
  assert.equal(tooltipHour, bucket.date, 'Tooltip hour must match bar label hour (09:00) in visitor timezone');

  // Verify other ranges format consistently without timezone shift
  const bucket1w = {
    startTime: '2026-11-02T00:00:00.000Z',
    endTime: '2026-11-02T06:00:00.000Z',
    count: 5,
  };
  const tooltip1w = formatCadenceTooltip(bucket1w, '1w', tz);
  assert.ok(tooltip1w.startsWith('Nov 02, 00:00–06:00'), `1w tooltip must preserve date and hours, got: ${tooltip1w}`);

  const bucket1m = {
    startTime: '2026-11-02T00:00:00.000Z',
    endTime: '2026-11-02T23:59:59.999Z',
    count: 2,
  };
  const tooltip1m = formatCadenceTooltip(bucket1m, '1m', tz);
  assert.ok(tooltip1m.startsWith('Nov 02, 2026'), `1m tooltip must preserve calendar date, got: ${tooltip1m}`);
});

// ---------------------------------------------------------------------------
// N019: Cadence edge cases (1y 13th month, all visitor timezone, 1d SQL)
// ---------------------------------------------------------------------------
test('N019: 1y cadence includes 13th month when time has elapsed past 00:00:00 on the 1st of the month', () => {
  // 2026-11-01 00:30:00 CDT (UTC-5) is 2026-11-01T05:30:00Z
  const now = new Date('2026-11-01T05:30:00Z');
  const tz = 'America/Chicago';
  const cadenceRows = [{ ym: '2025-11', count: 1 }];

  const { activityCadence } = buildActivityCadence({
    range: '1y',
    tz,
    now,
    cadenceRows,
  });

  assert.equal(activityCadence.length, 13, 'Must contain 13 month buckets when after 00:00:00 on the 1st');
  const earliest = activityCadence[0];
  assert.equal(earliest.date, 'Nov', 'Earliest bucket must be Nov (from previous year)');
  assert.equal(earliest.count, 1, 'Nov 2025 play must be included');
});

test('N019: all range uses visitor timezone year instead of server-local year', () => {
  // At 2026-01-01T07:00:00Z, server in UTC or US/Central is 2026, but in Pacific/Honolulu (UTC-10) it is 2025-12-31 21:00:00
  const now = new Date('2026-01-01T07:00:00Z');
  const tz = 'Pacific/Honolulu';
  const cadenceRows = [{ play_year: 2025, count: 5 }];

  const { activityCadence } = buildActivityCadence({
    range: 'all',
    tz,
    now,
    cadenceRows,
  });

  const years = activityCadence.map((b) => b.date);
  assert.equal(years[years.length - 1], '2025', 'End year must be 2025 according to visitor timezone');
});

test('N019: 1d SQL query uses DATE_TRUNC with AT TIME ZONE UTC', async () => {
  const { loadTs } = await import('./helpers/load-ts');
  const cadenceModule = loadTs('src/lib/db/queries/cadence.ts', {
    '../index': {
      getDb: () => (strings: TemplateStringsArray, ..._vals: unknown[]) => ({ strings: Array.from(strings) }),
    },
  });
  const sqlQuery1d = cadenceModule.buildCadenceQuery('1d', 'America/New_York');
  const queryText = (sqlQuery1d as unknown as { strings: string[] }).strings.join(' ');
  assert.ok(
    queryText.includes("DATE_TRUNC('hour', p.played_at AT TIME ZONE 'UTC')"),
    "1d query must truncate using AT TIME ZONE 'UTC'"
  );
});
