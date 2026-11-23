import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RANGE_KEYS } from "../src/lib/types";
import {
  DEFAULT_OVERVIEW_RANGE,
  PRESET_GRANULARITY,
  PRESET_SPAN_MS,
  drillSelection,
  elapsedWindowDays,
  formatRangeLabel,
  formatRangeParam,
  getLocalCalendarParts,
  isSameRange,
  localDateKey,
  localDateToInstant,
  parseRangeParam,
  presetRange,
  previousWindow,
  rangeGranularity,
  resolveRangeWindow,
  type RangeSelection,
  type TimeWindow,
} from "../src/lib/range";

const DAY_MS = 86_400_000;

describe("parseRangeParam / formatRangeParam / isSameRange", () => {
  it("round-trips all preset keys and valid date windows", () => {
    for (const key of RANGE_KEYS) {
      const parsed = parseRangeParam(key);
      assert.deepEqual(parsed, presetRange(key));
      assert.equal(formatRangeParam(parsed!), key);
    }

    const validWindows = [
      "2025-11-01..2025-11-30",
      "2025-11-03..2025-11-03",
      "2024-02-29..2024-02-29",
      "2000-01-01..2100-01-01",
      "0099-01-01..0099-12-31",
      "0096-02-29..0096-02-29",
      "0001-01-01..0001-01-01",
      "9999-12-31..9999-12-31",
    ];
    for (const raw of validWindows) {
      const parsed = parseRangeParam(raw);
      assert.ok(parsed && parsed.kind === "window", `expected window for ${raw}`);
      assert.equal(formatRangeParam(parsed), raw);
    }

    assert.deepEqual(DEFAULT_OVERVIEW_RANGE, { kind: "preset", key: "1w" });
    assert.equal(isSameRange(presetRange("1w"), DEFAULT_OVERVIEW_RANGE), true);
    assert.equal(isSameRange(presetRange("1d"), presetRange("1w")), false);
    assert.equal(
      isSameRange(
        { kind: "window", from: "2025-11-01", to: "2025-11-30" },
        { kind: "window", from: "2025-11-01", to: "2025-11-30" },
      ),
      true,
    );
    assert.equal(
      isSameRange(
        { kind: "window", from: "2025-11-01", to: "2025-11-30" },
        presetRange("1m"),
      ),
      false,
    );
  });

  it("rejects bad dates, reversed windows, >100y spans, and junk", () => {
    const invalid = [
      null,
      undefined,
      "",
      " 1w",
      "1w ",
      "2w",
      "2025-02-30..2025-03-01",
      "2025-02-29..2025-03-01",
      "2025-13-01..2025-13-02",
      "2025-00-10..2025-01-10",
      "2025-11-30..2025-11-01",
      "1900-01-01..2000-01-02",
      "2025-11-01",
      "2025-11-01..2025-11-30..2025-12-01",
      "0000-01-01..0000-01-01",
      "0099-02-29..0099-03-01",
      "not-a-range",
    ];
    for (const raw of invalid) {
      assert.equal(parseRangeParam(raw), null, `expected null for ${String(raw)}`);
    }
  });
});

describe("localDateToInstant / localDateKey / getLocalCalendarParts", () => {
  it("resolves America/Chicago DST transition days", () => {
    // 2026-03-08 springs forward at 02:00 CST -> CDT; midnight is still CST (UTC-6).
    const springStart = localDateToInstant("2026-03-08", "America/Chicago");
    assert.equal(springStart.toISOString(), "2026-03-08T06:00:00.000Z");
    assert.equal(localDateKey(springStart, "America/Chicago"), "2026-03-08");
    assert.equal(
      localDateKey(new Date(springStart.getTime() - 1), "America/Chicago"),
      "2026-03-07",
    );
    const springNext = localDateToInstant("2026-03-09", "America/Chicago");
    assert.equal(springNext.toISOString(), "2026-03-09T05:00:00.000Z");
    assert.equal((springNext.getTime() - springStart.getTime()) / 3_600_000, 23);

    // 2026-11-01 falls back at 02:00 CDT -> CST; midnight is still CDT (UTC-5).
    const fallStart = localDateToInstant("2026-11-01", "America/Chicago");
    assert.equal(fallStart.toISOString(), "2026-11-01T05:00:00.000Z");
    assert.equal(localDateKey(fallStart, "America/Chicago"), "2026-11-01");
    assert.equal(
      localDateKey(new Date(fallStart.getTime() - 1), "America/Chicago"),
      "2026-10-31",
    );
    const fallNext = localDateToInstant("2026-11-02", "America/Chicago");
    assert.equal(fallNext.toISOString(), "2026-11-02T06:00:00.000Z");
    assert.equal((fallNext.getTime() - fallStart.getTime()) / 3_600_000, 25);
  });

  it("resolves half-hour offset zone Asia/Kolkata", () => {
    const start = localDateToInstant("2026-06-15", "Asia/Kolkata");
    assert.equal(start.toISOString(), "2026-06-14T18:30:00.000Z");
    assert.deepEqual(getLocalCalendarParts(start, "Asia/Kolkata"), {
      year: 2026,
      month: 6,
      day: 15,
      hour: 0,
      minute: 0,
      second: 0,
    });
  });

  it("resolves a zone that skips midnight (America/Santiago 2026-09-06)", () => {
    const start = localDateToInstant("2026-09-06", "America/Santiago");
    assert.equal(localDateKey(start, "America/Santiago"), "2026-09-06");
    assert.equal(
      localDateKey(new Date(start.getTime() - 1), "America/Santiago"),
      "2026-09-05",
    );
    assert.equal(start.toISOString(), "2026-09-06T04:00:00.000Z");
    const parts = getLocalCalendarParts(start, "America/Santiago");
    assert.equal(parts.year, 2026);
    assert.equal(parts.month, 9);
    assert.equal(parts.day, 6);
    assert.equal(parts.hour, 1);
  });

  it("refines sub-hour skipped midnight to the exact boundary (Asia/Kathmandu 1986-01-01)", () => {
    const start = localDateToInstant("1986-01-01", "Asia/Kathmandu");
    assert.equal(start.toISOString(), "1985-12-31T18:30:00.000Z");
    assert.equal(localDateKey(start, "Asia/Kathmandu"), "1986-01-01");
    assert.equal(
      localDateKey(new Date(start.getTime() - 1), "Asia/Kathmandu"),
      "1985-12-31",
    );
    assert.deepEqual(getLocalCalendarParts(start, "Asia/Kathmandu"), {
      year: 1986,
      month: 1,
      day: 1,
      hour: 0,
      minute: 15,
      second: 0,
    });
  });

  it("resolves a fully skipped local day to the next representable day (Pacific/Apia 2011-12-30)", () => {
    const skipped = localDateToInstant("2011-12-30", "Pacific/Apia");
    const nextDay = localDateToInstant("2011-12-31", "Pacific/Apia");
    assert.equal(skipped.toISOString(), "2011-12-30T10:00:00.000Z");
    assert.equal(skipped.getTime(), nextDay.getTime());
    assert.equal(localDateKey(skipped, "Pacific/Apia"), "2011-12-31");
    assert.equal(
      localDateKey(new Date(skipped.getTime() - 1), "Pacific/Apia"),
      "2011-12-29",
    );
  });

  it("resolves CE years 0001-0099 without 1900 remapping", () => {
    const y99 = localDateToInstant("0099-01-01", "America/Chicago");
    assert.equal(localDateKey(y99, "America/Chicago"), "0099-01-01");
    assert.equal(
      localDateKey(new Date(y99.getTime() - 1), "America/Chicago"),
      "0098-12-31",
    );

    const y01 = localDateToInstant("0001-01-01", "America/Chicago");
    assert.equal(localDateKey(y01, "America/Chicago"), "0001-01-01");
    assert.equal(
      getLocalCalendarParts(new Date(y01.getTime() - 1), "America/Chicago").year,
      0,
    );
  });
});

describe("resolveRangeWindow", () => {
  const now = new Date("2026-06-15T18:00:00.000Z");

  it("resolves non-all presets to [now - span, now)", () => {
    const keys = ["1d", "1w", "1m", "6m", "1y"] as const;
    for (const key of keys) {
      const win = resolveRangeWindow(presetRange(key), {
        now,
        tz: "America/Chicago",
        logStart: "2021-04-02T12:00:00.000Z",
      });
      assert.equal(win.to, now.toISOString());
      assert.equal(
        Date.parse(win.to) - Date.parse(win.from),
        PRESET_SPAN_MS[key],
      );
    }
  });

  it("resolves all preset with non-null and null logStart", () => {
    // 2021-01-01T02:00:00Z is still 2020-12-31 in America/Chicago.
    const withLogStart = resolveRangeWindow(presetRange("all"), {
      now,
      tz: "America/Chicago",
      logStart: "2021-01-01T02:00:00.000Z",
    });
    assert.equal(
      withLogStart.from,
      localDateToInstant("2020-01-01", "America/Chicago").toISOString(),
    );
    assert.equal(withLogStart.to, now.toISOString());

    const withoutLogStart = resolveRangeWindow(presetRange("all"), {
      now,
      tz: "America/Chicago",
      logStart: null,
    });
    assert.equal(
      withoutLogStart.from,
      localDateToInstant("2026-01-01", "America/Chicago").toISOString(),
    );
    assert.equal(withoutLogStart.to, now.toISOString());
  });

  it("resolves fixed windows to [localDateToInstant(from), localDateToInstant(to + 1 day))", () => {
    const win = resolveRangeWindow(
      { kind: "window", from: "2025-11-01", to: "2025-11-30" },
      { now, tz: "America/Chicago", logStart: null },
    );
    assert.equal(
      win.from,
      localDateToInstant("2025-11-01", "America/Chicago").toISOString(),
    );
    assert.equal(
      win.to,
      localDateToInstant("2025-12-01", "America/Chicago").toISOString(),
    );

    const skippedDay = resolveRangeWindow(
      { kind: "window", from: "2011-12-30", to: "2011-12-30" },
      { now, tz: "Pacific/Apia", logStart: null },
    );
    assert.deepEqual(skippedDay, {
      from: "2011-12-30T10:00:00.000Z",
      to: "2011-12-30T10:00:00.000Z",
    });

    const rollover99 = resolveRangeWindow(
      { kind: "window", from: "0099-12-31", to: "0099-12-31" },
      { now, tz: "UTC", logStart: null },
    );
    assert.deepEqual(rollover99, {
      from: "0099-12-31T00:00:00.000Z",
      to: "0100-01-01T00:00:00.000Z",
    });

    const rollover9999 = resolveRangeWindow(
      { kind: "window", from: "9999-12-31", to: "9999-12-31" },
      { now, tz: "UTC", logStart: null },
    );
    assert.deepEqual(rollover9999, {
      from: "9999-12-31T00:00:00.000Z",
      to: "+010000-01-01T00:00:00.000Z",
    });
  });
});

describe("rangeGranularity", () => {
  it("returns PRESET_GRANULARITY for presets", () => {
    const dummy: TimeWindow = {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-01-02T00:00:00.000Z",
    };
    for (const key of RANGE_KEYS) {
      assert.equal(rangeGranularity(presetRange(key), dummy), PRESET_GRANULARITY[key]);
    }
  });

  it("matches every window threshold edge", () => {
    const sel: RangeSelection = { kind: "window", from: "2025-01-01", to: "2025-01-02" };
    const winOfDays = (days: number, extraMs = 0): TimeWindow => {
      const from = Date.UTC(2025, 0, 1);
      return {
        from: new Date(from).toISOString(),
        to: new Date(from + days * DAY_MS + extraMs).toISOString(),
      };
    };

    assert.equal(rangeGranularity(sel, winOfDays(1)), "hour");
    assert.equal(rangeGranularity(sel, winOfDays(2)), "hour");
    assert.equal(rangeGranularity(sel, winOfDays(2, 1)), "block6h");
    assert.equal(rangeGranularity(sel, winOfDays(8)), "block6h");
    assert.equal(rangeGranularity(sel, winOfDays(8, 1)), "day");
    assert.equal(rangeGranularity(sel, winOfDays(45)), "day");
    assert.equal(rangeGranularity(sel, winOfDays(45, 1)), "week");
    assert.equal(rangeGranularity(sel, winOfDays(200)), "week");
    assert.equal(rangeGranularity(sel, winOfDays(200, 1)), "month");
    assert.equal(rangeGranularity(sel, winOfDays(400)), "month");
    assert.equal(rangeGranularity(sel, winOfDays(400, 1)), "year");
  });
});

describe("drillSelection", () => {
  const tz = "America/Chicago";

  it("drills year, month (including December and leap February), week, day, block6h, and hour", () => {
    assert.deepEqual(
      drillSelection(
        {
          startTime: localDateToInstant("2025-01-01", tz).toISOString(),
          endTime: new Date(localDateToInstant("2026-01-01", tz).getTime() - 1).toISOString(),
        },
        "year",
        tz,
      ),
      { kind: "window", from: "2025-01-01", to: "2025-12-31" },
    );

    assert.deepEqual(
      drillSelection(
        {
          startTime: localDateToInstant("2025-12-01", tz).toISOString(),
          endTime: new Date(localDateToInstant("2026-01-01", tz).getTime() - 1).toISOString(),
        },
        "month",
        tz,
      ),
      { kind: "window", from: "2025-12-01", to: "2025-12-31" },
    );

    assert.deepEqual(
      drillSelection(
        {
          startTime: localDateToInstant("2024-02-01", tz).toISOString(),
          endTime: new Date(localDateToInstant("2024-03-01", tz).getTime() - 1).toISOString(),
        },
        "month",
        tz,
      ),
      { kind: "window", from: "2024-02-01", to: "2024-02-29" },
    );

    assert.deepEqual(
      drillSelection(
        {
          startTime: localDateToInstant("2025-11-28", tz).toISOString(),
          endTime: new Date(localDateToInstant("2025-12-05", tz).getTime() - 1).toISOString(),
        },
        "week",
        tz,
      ),
      { kind: "window", from: "2025-11-28", to: "2025-12-04" },
    );

    assert.deepEqual(
      drillSelection(
        {
          startTime: localDateToInstant("2025-11-03", tz).toISOString(),
          endTime: new Date(localDateToInstant("2025-11-04", tz).getTime() - 1).toISOString(),
        },
        "day",
        tz,
      ),
      { kind: "window", from: "2025-11-03", to: "2025-11-03" },
    );

    assert.deepEqual(
      drillSelection(
        {
          startTime: new Date(localDateToInstant("2025-11-03", tz).getTime() + 6 * 3_600_000).toISOString(),
          endTime: new Date(localDateToInstant("2025-11-03", tz).getTime() + 12 * 3_600_000 - 1).toISOString(),
        },
        "block6h",
        tz,
      ),
      { kind: "window", from: "2025-11-03", to: "2025-11-03" },
    );

    assert.equal(
      drillSelection(
        {
          startTime: "2025-11-03T12:00:00.000Z",
          endTime: "2025-11-03T12:59:59.999Z",
        },
        "hour",
        tz,
      ),
      null,
    );
  });
});

describe("formatRangeLabel", () => {
  it("formats every label form", () => {
    assert.equal(formatRangeLabel(presetRange("1w")), "1w");
    assert.equal(
      formatRangeLabel({ kind: "window", from: "2025-01-01", to: "2025-12-31" }),
      "2025",
    );
    assert.equal(
      formatRangeLabel({ kind: "window", from: "2025-11-01", to: "2025-11-30" }),
      "Nov 2025",
    );
    assert.equal(
      formatRangeLabel({ kind: "window", from: "2024-02-01", to: "2024-02-29" }),
      "Feb 2024",
    );
    assert.equal(
      formatRangeLabel({ kind: "window", from: "2025-11-03", to: "2025-11-03" }),
      "Nov 3, 2025",
    );
    assert.equal(
      formatRangeLabel({ kind: "window", from: "2025-11-03", to: "2025-11-09" }),
      "Nov 3–9, 2025",
    );
    assert.equal(
      formatRangeLabel({ kind: "window", from: "2025-11-28", to: "2025-12-04" }),
      "Nov 28 – Dec 4, 2025",
    );
    assert.equal(
      formatRangeLabel({ kind: "window", from: "2025-12-28", to: "2026-01-03" }),
      "Dec 28, 2025 – Jan 3, 2026",
    );
  });
});

describe("previousWindow / elapsedWindowDays", () => {
  it("computes the immediately preceding equal-span window", () => {
    const win: TimeWindow = {
      from: "2025-11-10T00:00:00.000Z",
      to: "2025-11-20T00:00:00.000Z",
    };
    assert.deepEqual(previousWindow(win), {
      from: "2025-10-31T00:00:00.000Z",
      to: "2025-11-10T00:00:00.000Z",
    });
  });

  it("clamps elapsedWindowDays at now when the window ends in the future and floors at 1", () => {
    const win: TimeWindow = {
      from: "2026-06-01T00:00:00.000Z",
      to: "2026-07-01T00:00:00.000Z",
    };
    assert.equal(elapsedWindowDays(win, new Date("2026-06-11T00:00:00.000Z")), 10);
    assert.equal(elapsedWindowDays(win, new Date("2026-06-01T06:00:00.000Z")), 1);
    assert.equal(elapsedWindowDays(win, new Date("2026-05-20T00:00:00.000Z")), 1);
    assert.equal(elapsedWindowDays(win, new Date("2026-08-01T00:00:00.000Z")), 30);
  });
});
