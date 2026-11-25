import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarThresholds,
  calendarLevel,
  normalizeSelection,
  selectionFromRange,
  selectionToRange,
  monthSelection,
  yearSelection,
  isSelectableDate,
  calendarYears,
  weekColumns,
  monthStartColumns,
  clipSelectionToYear,
  summarizeCalendar,
  formatCalendarMetrics,
  type CalendarDay,
  type CalendarSelection,
} from '../src/lib/calendar';

test('calendarThresholds computes 25th, 50th, 75th percentiles', () => {
  // [1,2,3,4,5,6,7,8] gives [2,4,6]
  assert.deepEqual(calendarThresholds([1, 2, 3, 4, 5, 6, 7, 8]), [2, 4, 6]);

  // Unsorted counts are sorted
  assert.deepEqual(calendarThresholds([8, 1, 7, 2, 6, 3, 5, 4]), [2, 4, 6]);

  // Zeros and negative numbers are ignored
  assert.deepEqual(calendarThresholds([0, 1, -2, 2, 0, 3, 4, 5, 6, 7, 8]), [2, 4, 6]);

  // Empty or all-zero input gives [1, 1, 1]
  assert.deepEqual(calendarThresholds([]), [1, 1, 1]);
  assert.deepEqual(calendarThresholds([0, 0, 0]), [1, 1, 1]);

  // Single count gives [x, x, x]
  assert.deepEqual(calendarThresholds([5]), [5, 5, 5]);
});

test('calendarLevel maps counts to 0..4 according to thresholds', () => {
  const t: [number, number, number] = [2, 4, 6];

  // 0 or negative -> 0
  assert.equal(calendarLevel(0, t), 0);
  assert.equal(calendarLevel(-5, t), 0);

  // Exactly at t[0] -> 1
  assert.equal(calendarLevel(1, t), 1);
  assert.equal(calendarLevel(2, t), 1);

  // <= t[1] -> 2
  assert.equal(calendarLevel(3, t), 2);
  assert.equal(calendarLevel(4, t), 2);

  // <= t[2] -> 3
  assert.equal(calendarLevel(5, t), 3);
  assert.equal(calendarLevel(6, t), 3);

  // One above t[2] -> 4
  assert.equal(calendarLevel(7, t), 4);
  assert.equal(calendarLevel(100, t), 4);
});

test('normalizeSelection orders dates so from <= to', () => {
  assert.deepEqual(normalizeSelection('2024-01-01', '2024-01-10'), {
    from: '2024-01-01',
    to: '2024-01-10',
  });
  assert.deepEqual(normalizeSelection('2024-01-10', '2024-01-01'), {
    from: '2024-01-01',
    to: '2024-01-10',
  });
  assert.deepEqual(normalizeSelection('2024-01-05', '2024-01-05'), {
    from: '2024-01-05',
    to: '2024-01-05',
  });
});

test('selectionFromRange and selectionToRange conversion', () => {
  assert.deepEqual(
    selectionFromRange({ kind: 'window', from: '2024-01-01', to: '2024-01-15' }),
    { from: '2024-01-01', to: '2024-01-15' },
  );
  assert.equal(selectionFromRange({ kind: 'preset', key: '1w' }), null);

  assert.deepEqual(
    selectionToRange({ from: '2024-01-01', to: '2024-01-15' }),
    { kind: 'window', from: '2024-01-01', to: '2024-01-15' },
  );
});

test('monthSelection generates whole month range unclipped', () => {
  // Leap year Feb
  assert.deepEqual(monthSelection(2024, 2), {
    from: '2024-02-01',
    to: '2024-02-29',
  });
  // Non-leap year Feb
  assert.deepEqual(monthSelection(2025, 2), {
    from: '2025-02-01',
    to: '2025-02-28',
  });
  // 31-day month
  assert.deepEqual(monthSelection(2024, 1), {
    from: '2024-01-01',
    to: '2024-01-31',
  });
  // 30-day month
  assert.deepEqual(monthSelection(2024, 4), {
    from: '2024-04-01',
    to: '2024-04-30',
  });
});

test('yearSelection generates whole year range unclipped', () => {
  assert.deepEqual(yearSelection(2024), {
    from: '2024-01-01',
    to: '2024-12-31',
  });
});

test('isSelectableDate checks firstDate <= date <= today', () => {
  const firstDate = '2024-05-02';
  const today = '2026-11-23';

  assert.equal(isSelectableDate('2024-05-01', firstDate, today), false);
  assert.equal(isSelectableDate('2024-05-02', firstDate, today), true);
  assert.equal(isSelectableDate('2025-06-15', firstDate, today), true);
  assert.equal(isSelectableDate('2026-11-23', firstDate, today), true);
  assert.equal(isSelectableDate('2026-11-24', firstDate, today), false);

  // When firstDate is null, no dates are selectable
  assert.equal(isSelectableDate('2025-01-01', null, today), false);
});

test('calendarYears returns descending years from today down to firstDate', () => {
  assert.deepEqual(calendarYears('2024-05-02', '2026-11-23'), [2026, 2025, 2024]);
  assert.deepEqual(calendarYears('2026-01-01', '2026-11-23'), [2026]);
  assert.deepEqual(calendarYears(null, '2026-11-23'), []);
});

test('weekColumns(2024) places Jan 1 at column 0 row 1 and has 366 non-null cells', () => {
  const cols = weekColumns(2024);
  assert.ok(cols.length >= 53);
  // Jan 1 2024 was Monday -> row 1 (Sunday = 0)
  assert.equal(cols[0][0], null);
  assert.equal(cols[0][1], '2024-01-01');

  // Verify all cells have length 7
  for (const col of cols) {
    assert.equal(col.length, 7);
  }

  // Count non-null cells
  const nonNull = cols.flat().filter((c): c is string => c !== null);
  assert.equal(nonNull.length, 366);

  // Independently generate the full expected leap-year sequence
  const expectedDates: string[] = [];
  const daysInMonths2024 = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  for (let m = 1; m <= 12; m++) {
    const daysInM = daysInMonths2024[m - 1];
    for (let d = 1; d <= daysInM; d++) {
      expectedDates.push(`2024-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  assert.deepEqual(nonNull, expectedDates);

  // Ensure unique dates and correct sequence
  const dateSet = new Set(nonNull);
  assert.equal(dateSet.size, 366);
  assert.ok(dateSet.has('2024-01-01'));
  assert.ok(dateSet.has('2024-02-29'));
  assert.ok(dateSet.has('2024-12-31'));
});

test('weekColumns(2033) places Jan 1 at row 6', () => {
  const cols = weekColumns(2033);
  assert.ok(cols.length >= 53);
  // Jan 1 2033 was Saturday -> row 6 (Sunday = 0)
  assert.equal(cols[0][0], null);
  assert.equal(cols[0][1], null);
  assert.equal(cols[0][2], null);
  assert.equal(cols[0][3], null);
  assert.equal(cols[0][4], null);
  assert.equal(cols[0][5], null);
  assert.equal(cols[0][6], '2033-01-01');
  assert.equal(cols[1][0], '2033-01-02');

  const nonNull = cols.flat().filter((c): c is string => c !== null);
  assert.equal(nonNull.length, 365);
});

test('weekColumns handles leap year starting on Saturday (54 cols) and Sunday (53 cols)', () => {
  // 2028 is a leap year starting on Saturday (Jan 1 is Saturday, row 6)
  const cols2028 = weekColumns(2028);
  assert.equal(cols2028.length, 54);
  assert.equal(cols2028[0][6], '2028-01-01');
  assert.equal(cols2028[53][0], '2028-12-31');
  assert.equal(cols2028.flat().filter((c): c is string => c !== null).length, 366);

  // 2012 was a leap year starting on Sunday (Jan 1 was Sunday, row 0)
  const cols2012 = weekColumns(2012);
  assert.equal(cols2012.length, 53);
  assert.equal(cols2012[0][0], '2012-01-01');
  assert.equal(cols2012[52][1], '2012-12-31');
  assert.equal(cols2012.flat().filter((c): c is string => c !== null).length, 366);
});

test('monthStartColumns returns 12 entries and 2024[1] holds Feb 1', () => {
  const cols = weekColumns(2024);
  const startCols = monthStartColumns(2024);
  assert.equal(startCols.length, 12);

  // Month 2 (Feb) is index 1
  const febCol = startCols[1];
  assert.ok(cols[febCol].includes('2024-02-01'));

  // Check each month 1..12
  for (let m = 1; m <= 12; m++) {
    const colIndex = startCols[m - 1];
    const expectedDate = `2024-${String(m).padStart(2, '0')}-01`;
    assert.ok(
      cols[colIndex].includes(expectedDate),
      `Expected col ${colIndex} to include ${expectedDate}`,
    );
  }
});

test('clipSelectionToYear clips across year boundaries and handles no overlap', () => {
  // Overlap inside year
  assert.deepEqual(
    clipSelectionToYear({ from: '2024-03-01', to: '2024-06-30' }, 2024),
    { from: '2024-03-01', to: '2024-06-30' },
  );

  // Across year boundary
  assert.deepEqual(
    clipSelectionToYear({ from: '2023-11-01', to: '2024-02-15' }, 2024),
    { from: '2024-01-01', to: '2024-02-15' },
  );

  assert.deepEqual(
    clipSelectionToYear({ from: '2024-11-01', to: '2025-02-15' }, 2024),
    { from: '2024-11-01', to: '2024-12-31' },
  );

  // Whole year enclosed
  assert.deepEqual(
    clipSelectionToYear({ from: '2023-01-01', to: '2025-12-31' }, 2024),
    { from: '2024-01-01', to: '2024-12-31' },
  );

  // No overlap
  assert.equal(
    clipSelectionToYear({ from: '2023-01-01', to: '2023-12-31' }, 2024),
    null,
  );
  assert.equal(
    clipSelectionToYear({ from: '2025-01-01', to: '2025-12-31' }, 2024),
    null,
  );
  assert.equal(clipSelectionToYear(null, 2024), null);
});

test('summarizeCalendar clips span to [firstDate, today] and breaks ties by earliest date', () => {
  const days: CalendarDay[] = [
    { date: '2024-01-10', count: 10 },
    { date: '2024-01-15', count: 25 },
    { date: '2024-01-20', count: 25 }, // tied peak with Jan 15
    { date: '2024-01-25', count: 5 },
  ];
  const bounds = { firstDate: '2024-01-12', today: '2024-01-22' };

  // Span starts before firstDate and ends after today
  const sel: CalendarSelection = { from: '2024-01-01', to: '2024-01-31' };
  const summary = summarizeCalendar(days, sel, bounds);

  // Clipped to 2024-01-12 .. 2024-01-22 (11 inclusive days: 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22)
  assert.equal(summary.spanDays, 11);
  // Matching days: 2024-01-15 (25) and 2024-01-20 (25)
  assert.equal(summary.plays, 50);
  assert.equal(summary.activeDays, 2);
  assert.equal(summary.dailyAvg, 50 / 11);
  // Tied peak resolves to earlier date: 2024-01-15
  assert.deepEqual(summary.peak, { date: '2024-01-15', count: 25 });

  // null sel defaults to whole archive [firstDate, today]
  const archiveSummary = summarizeCalendar(days, null, bounds);
  assert.deepEqual(archiveSummary, summary);

  // Null firstDate
  const emptyBounds = { firstDate: null, today: '2024-01-22' };
  const emptySummary = summarizeCalendar(days, null, emptyBounds);
  assert.equal(emptySummary.plays, 0);
  assert.equal(emptySummary.activeDays, 0);
  assert.equal(emptySummary.spanDays, 0);
  assert.equal(emptySummary.dailyAvg, 0);
  assert.equal(emptySummary.peak, null);

  // Selection with no overlap with [firstDate, today]
  const noOverlapSel: CalendarSelection = { from: '2024-02-01', to: '2024-02-10' };
  const noOverlapSummary = summarizeCalendar(days, noOverlapSel, bounds);
  assert.equal(noOverlapSummary.spanDays, 0);
  assert.equal(noOverlapSummary.plays, 0);
  assert.equal(noOverlapSummary.activeDays, 0);
  assert.equal(noOverlapSummary.dailyAvg, 0);
  assert.equal(noOverlapSummary.peak, null);
});

test('formatCalendarMetrics formats correctly for single year and cross year spans', () => {
  const bounds = { firstDate: '2024-01-01', today: '2026-11-23' };

  // Single year span
  const singleYearSummary = {
    plays: 1250,
    activeDays: 45,
    spanDays: 60,
    dailyAvg: 1250 / 60,
    peak: { date: '2025-11-03', count: 77 },
  };
  const singleYearSel: CalendarSelection = { from: '2025-10-01', to: '2025-11-30' };
  const m1 = formatCalendarMetrics(singleYearSummary, singleYearSel, bounds);
  assert.equal(m1[0], '1,250');
  assert.equal(m1[1], '45 / 60');
  assert.equal(m1[2], '20.8');
  assert.equal(m1[3], 'Nov 3 · 77');

  // Cross year span (e.g. 2024 to 2025)
  const crossYearSel: CalendarSelection = { from: '2024-11-01', to: '2025-01-31' };
  const m2 = formatCalendarMetrics(singleYearSummary, crossYearSel, bounds);
  // Uses U+2019 right single quote
  assert.equal(m2[3], 'Nov 3 ’25 · 77');

  // Null selection across multiple years in bounds
  const m3 = formatCalendarMetrics(singleYearSummary, null, bounds);
  assert.equal(m3[3], 'Nov 3 ’25 · 77');

  // Null peak
  const emptySummary = {
    plays: 0,
    activeDays: 0,
    spanDays: 0,
    dailyAvg: 0,
    peak: null,
  };
  const m4 = formatCalendarMetrics(emptySummary, singleYearSel, bounds);
  assert.deepEqual(m4, ['0', '0 / 0', '0.0', '--']);
});

test('handles years below 0100 with four-digit date keys without Date.UTC rebasing', () => {
  // clipSelectionToYear with year 42
  assert.deepEqual(
    clipSelectionToYear({ from: '0042-01-15', to: '0042-06-30' }, 42),
    { from: '0042-01-15', to: '0042-06-30' },
  );

  // monthSelection with year 42 and leap year 4
  assert.deepEqual(monthSelection(42, 2), {
    from: '0042-02-01',
    to: '0042-02-28',
  });
  assert.deepEqual(monthSelection(4, 2), {
    from: '0004-02-01',
    to: '0004-02-29',
  });

  // weekColumns with year 42
  const cols = weekColumns(42);
  const nonNull = cols.flat().filter((c): c is string => c !== null);
  assert.equal(nonNull.length, 365);
  assert.equal(nonNull[0], '0042-01-01');
  assert.equal(nonNull[nonNull.length - 1], '0042-12-31');

  // monthStartColumns with year 42
  const startCols = monthStartColumns(42);
  assert.equal(startCols.length, 12);
  assert.ok(cols[startCols[1]].includes('0042-02-01'));
});
