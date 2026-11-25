import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { daysBetween } from "../src/lib/range";
import { buildRulerUnits } from "../src/lib/ruler/units";
import {
  FIXED_PPD,
  allBlend,
  nearestLevel,
  restDay,
  snapPpd,
  unitCenterDay,
} from "../src/lib/ruler/zoom";
import {
  LABEL_ROW,
  MAJOR_TICK,
  MEDIUM_TICK,
  MINOR_TICK,
  PHANTOM_ALPHA,
  drawRuler,
  type RulerCtx,
  type RulerPalette,
} from "../src/lib/ruler/draw";

const FIRST_KEY = "2019-03-01";
const TODAY_KEY = "2026-11-22";
const ARCHIVE_DAYS = daysBetween(FIRST_KEY, TODAY_KEY);

const TEST_PALETTE: RulerPalette = {
  accent: "#38BDF8",
  major: "#8A8A82",
  minor: "#3A3A32",
  baseline: "#1C1C1A",
  label: "#8A8A82",
  font: '10px "Spline Sans Mono", monospace',
};

interface RectCall {
  x: number;
  y: number;
  w: number;
  h: number;
  globalAlpha: number;
  fillStyle: string;
}

interface TextCall {
  text: string;
  x: number;
  y: number;
  globalAlpha: number;
  fillStyle: string;
  textAlign: CanvasTextAlign;
}

function createRecordingCtx(): { ctx: RulerCtx; rects: RectCall[]; texts: TextCall[] } {
  const rects: RectCall[] = [];
  const texts: TextCall[] = [];
  const ctx: RulerCtx = {
    fillStyle: "#000000",
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    clearRect() {},
    fillRect(x: number, y: number, w: number, h: number) {
      rects.push({
        x,
        y,
        w,
        h,
        globalAlpha: ctx.globalAlpha,
        fillStyle: ctx.fillStyle,
      });
    },
    fillText(text: string, x: number, y: number) {
      texts.push({
        text,
        x,
        y,
        globalAlpha: ctx.globalAlpha,
        fillStyle: ctx.fillStyle,
        textAlign: ctx.textAlign,
      });
    },
    measureText(text: string) {
      return { width: text.length * 6 };
    },
  };
  return { ctx, rects, texts };
}

function findTickNearX(rects: RectCall[], expectedX: number, height: number): RectCall {
  const baseline = height - 1;
  const matches = rects.filter(
    (r) =>
      r.y + r.h === baseline &&
      r.h > 1 &&
      Math.abs(r.x + r.w / 2 - (expectedX + 0.5)) <= 1,
  );
  assert.equal(matches.length, 1, `Expected 1 tick near x=${expectedX}, found ${matches.length}`);
  return matches[0];
}

describe("zoom maths", () => {
  it("nearestLevel snaps FIXED_PPD.week to 'week'", () => {
    assert.equal(nearestLevel(FIXED_PPD.week, 396, ARCHIVE_DAYS), "week");
  });

  it("snapPpd('all', 396, archiveDays) equals 396 * 0.7 / archiveDays for positive archiveDays", () => {
    assert.equal(snapPpd("all", 396, ARCHIVE_DAYS), (396 * 0.7) / ARCHIVE_DAYS);
  });

  it("snapPpd('all', 396, 0) returns a finite positive scale for single-date/empty archives", () => {
    const scale = snapPpd("all", 396, 0);
    assert.ok(Number.isFinite(scale) && scale > 0);
  });

  it("allBlend is 0 at year ppd (and closer in) and 1 at all ppd", () => {
    const yearPpd = snapPpd("year", 396, ARCHIVE_DAYS);
    const allPpd = snapPpd("all", 396, ARCHIVE_DAYS);
    assert.equal(allBlend(yearPpd, 396, ARCHIVE_DAYS), 0);
    assert.equal(allBlend(FIXED_PPD.month, 396, ARCHIVE_DAYS), 0);
    assert.equal(allBlend(allPpd, 396, ARCHIVE_DAYS), 1);

    const midPpd = Math.sqrt(yearPpd * allPpd);
    const midBlend = allBlend(midPpd, 396, ARCHIVE_DAYS);
    assert.ok(midBlend > 0 && midBlend < 1);
  });

  it("restDay('month', '2026-11-22', ...) lands on the full midpoint of November (Nov 15.5 from firstKey)", () => {
    const novStart = daysBetween(FIRST_KEY, "2026-11-01");
    const expected = novStart + daysBetween("2026-11-01", "2026-11-30") / 2;
    assert.equal(restDay("month", "2026-11-22", FIRST_KEY, TODAY_KEY), expected);
    assert.equal(restDay("all", "2026-11-22", FIRST_KEY, TODAY_KEY), ARCHIVE_DAYS / 2);

    const { units, realLast } = buildRulerUnits("month", FIRST_KEY, TODAY_KEY);
    assert.equal(unitCenterDay(units[realLast], FIRST_KEY), expected);
  });
});

describe("drawRuler", () => {
  it("draws symmetric mirrored minor ticks and matching Jan 2027 phantom major tick height", () => {
    const width = 396;
    const height = 26;
    const { units, realFirst, realLast } = buildRulerUnits("month", FIRST_KEY, TODAY_KEY);
    const ppd = FIXED_PPD.month;
    const centers = units.map((u) => unitCenterDay(u, FIRST_KEY) * ppd);
    const offset = centers[realLast]; // centered on Nov 2026

    const { ctx, rects } = createRecordingCtx();
    drawRuler(ctx, {
      width,
      height,
      level: "month",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: realLast,
      allMode: false,
      palette: TEST_PALETTE,
    });

    // Mirrored minor pairs around Nov 2026: k=1 (Oct vs Dec), k=3 (Aug vs Feb), k=4 (Jul vs Mar), k=5 (Jun vs Apr), k=6 (May vs May)
    for (const k of [1, 3, 4, 5, 6]) {
      const leftIdx = realLast - k;
      const rightIdx = realLast + k;
      const leftX = Math.round(width / 2 + centers[leftIdx] - offset);
      const rightX = Math.round(width / 2 + centers[rightIdx] - offset);

      const leftTick = findTickNearX(rects, leftX, height);
      const rightTick = findTickNearX(rects, rightX, height);

      assert.equal(leftTick.h, MINOR_TICK);
      assert.equal(rightTick.h, MINOR_TICK);
      assert.equal(leftTick.w, rightTick.w);
      assert.equal(leftTick.fillStyle, TEST_PALETTE.minor);
      assert.equal(rightTick.fillStyle, TEST_PALETTE.minor);
      assert.equal(leftTick.globalAlpha, 1);
      assert.equal(rightTick.globalAlpha, PHANTOM_ALPHA);
    }

    // Jan 2027 phantom (realLast + 2) is MAJOR_TICK tall (9px)
    const jan2027Idx = realLast + 2;
    assert.equal(units[jan2027Idx].from, "2027-01-01");
    assert.equal(units[jan2027Idx].phantom, true);
    const jan2027X = Math.round(width / 2 + centers[jan2027Idx] - offset);
    const jan2027Tick = findTickNearX(rects, jan2027X, height);
    assert.equal(jan2027Tick.h, MAJOR_TICK);
    assert.equal(jan2027Tick.fillStyle, TEST_PALETTE.major);
    assert.equal(jan2027Tick.globalAlpha, PHANTOM_ALPHA);

    // Compare with a real unselected January (Jan 2026) centered on Feb 2026
    const jan2026Idx = units.findIndex((u) => u.from === "2026-01-01");
    assert.ok(jan2026Idx >= realFirst && jan2026Idx <= realLast);
    const feb2026Idx = jan2026Idx + 1;
    const febOffset = centers[feb2026Idx];
    const janRun = createRecordingCtx();
    drawRuler(janRun.ctx, {
      width,
      height,
      level: "month",
      units,
      centers,
      offset: febOffset,
      realFirst,
      realLast,
      selected: feb2026Idx,
      allMode: false,
      palette: TEST_PALETTE,
    });
    const jan2026X = Math.round(width / 2 + centers[jan2026Idx] - febOffset);
    const jan2026Tick = findTickNearX(janRun.rects, jan2026X, height);
    assert.equal(jan2026Tick.h, MAJOR_TICK);
    assert.equal(jan2026Tick.h, jan2027Tick.h);
    assert.equal(jan2026Tick.w, jan2027Tick.w);
    assert.equal(jan2026Tick.fillStyle, jan2027Tick.fillStyle);
    assert.equal(jan2026Tick.globalAlpha, 1);
  });

  it("uses no accent on ticks when selected is null, while still drawing the accent reticle", () => {
    const width = 396;
    const height = 26;
    const { units, realFirst, realLast } = buildRulerUnits("month", FIRST_KEY, TODAY_KEY);
    const ppd = FIXED_PPD.month;
    const centers = units.map((u) => unitCenterDay(u, FIRST_KEY) * ppd);
    const offset = centers[realLast];

    const { ctx, rects } = createRecordingCtx();
    drawRuler(ctx, {
      width,
      height,
      level: "month",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: null,
      allMode: false,
      palette: TEST_PALETTE,
    });

    const reticleX = Math.round(width / 2) - 1;
    const reticleRects = rects.filter(
      (r) =>
        r.x === reticleX &&
        r.y === LABEL_ROW &&
        r.w === 2 &&
        r.h === height - LABEL_ROW,
    );
    assert.equal(reticleRects.length, 1);
    assert.equal(reticleRects[0].fillStyle, TEST_PALETTE.accent);

    const accentTicks = rects.filter(
      (r) => r.fillStyle === TEST_PALETTE.accent && r.y !== LABEL_ROW,
    );
    assert.equal(accentTicks.length, 0);
  });

  it("hides the reticle and draws every real tick in accent when allMode is true", () => {
    const width = 396;
    const height = 26;
    const { units, realFirst, realLast } = buildRulerUnits("year", FIRST_KEY, TODAY_KEY);
    const ppd = snapPpd("all", width, ARCHIVE_DAYS);
    const centers = units.map((u) => unitCenterDay(u, FIRST_KEY) * ppd);
    const offset = (ARCHIVE_DAYS / 2) * ppd;

    const { ctx, rects } = createRecordingCtx();
    drawRuler(ctx, {
      width,
      height,
      level: "all",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: null,
      allMode: true,
      palette: TEST_PALETTE,
    });

    const reticleX = Math.round(width / 2) - 1;
    const reticleRects = rects.filter(
      (r) =>
        r.x === reticleX &&
        r.y === LABEL_ROW &&
        r.w === 2 &&
        r.h === height - LABEL_ROW,
    );
    assert.equal(reticleRects.length, 0);

    const baseline = height - 1;
    for (let i = realFirst; i <= realLast; i++) {
      const tickX = Math.round(width / 2 + centers[i] - offset);
      const tick = findTickNearX(rects, tickX, height);
      assert.equal(tick.fillStyle, TEST_PALETTE.accent);
      assert.equal(tick.w, 1.5);
      assert.equal(tick.globalAlpha, 1);
      assert.equal(tick.y + tick.h, baseline);
    }
  });

  it("caps ticks at height - 1 - LABEL_ROW on a 13px canvas and skips nonpositive reticle height", () => {
    const width = 396;
    const { units, realFirst, realLast } = buildRulerUnits("month", FIRST_KEY, TODAY_KEY);
    const ppd = FIXED_PPD.month;
    const centers = units.map((u) => unitCenterDay(u, FIRST_KEY) * ppd);
    const offset = centers[realLast];

    // 13px canvas: baseline=12, LABEL_ROW=11 -> tick zone is 1px tall
    const smallHeight = 13;
    const smallRun = createRecordingCtx();
    drawRuler(smallRun.ctx, {
      width,
      height: smallHeight,
      level: "month",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: realLast,
      allMode: false,
      palette: TEST_PALETTE,
    });

    const baseline13 = smallHeight - 1;
    const ticks13 = smallRun.rects.filter((r) => r.y + r.h === baseline13);
    assert.ok(ticks13.length > 0);
    for (const tick of ticks13) {
      assert.equal(tick.h, 1);
      assert.equal(tick.y, baseline13 - 1);
    }

    // 11px canvas: height - LABEL_ROW === 0 -> reticle must be skipped
    const tinyHeight = LABEL_ROW;
    const tinyRun = createRecordingCtx();
    drawRuler(tinyRun.ctx, {
      width,
      height: tinyHeight,
      level: "month",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: realLast,
      allMode: false,
      palette: TEST_PALETTE,
    });

    const reticleX = Math.round(width / 2) - 1;
    const reticleRects = tinyRun.rects.filter(
      (r) => r.x === reticleX && r.y === LABEL_ROW && r.w === 2,
    );
    assert.equal(reticleRects.length, 0);
  });

  it("draws Sunday numbers, Dec label, medium 7px Sunday ticks, and priority-3 accent selected label", () => {
    const width = 396;
    const height = 26;
    const ppd = 12;
    const { units, realFirst, realLast } = buildRulerUnits("day", FIRST_KEY, "2026-11-24");
    const centers = units.map((u) => unitCenterDay(u, FIRST_KEY) * ppd);
    const centerIdx = units.findIndex((u) => u.from === "2026-11-24");
    const offset = centers[centerIdx];

    // Unselected: "15", "22", "29", and "Dec" all draw without collision
    const unselectedRun = createRecordingCtx();
    drawRuler(unselectedRun.ctx, {
      width,
      height,
      level: "day",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: null,
      allMode: false,
      palette: { ...TEST_PALETTE, medium: "#5A5A52" },
    });

    const drawnTexts = unselectedRun.texts.map((t) => t.text);
    for (const expected of ["15", "22", "29", "Dec"]) {
      assert.ok(drawnTexts.includes(expected), `Expected label ${expected} in ${drawnTexts.join(", ")}`);
    }
    const decCall = unselectedRun.texts.find((t) => t.text === "Dec")!;
    assert.equal(decCall.globalAlpha, PHANTOM_ALPHA);
    assert.equal(decCall.y, 1);
    assert.equal(decCall.textAlign, "center");

    // Sunday ticks are MEDIUM_TICK (7px) tall and use palette.medium (falling back to minor)
    const nov22Idx = units.findIndex((u) => u.from === "2026-11-22");
    const nov22X = Math.round(width / 2 + centers[nov22Idx] - offset);
    const nov22Tick = findTickNearX(unselectedRun.rects, nov22X, height);
    assert.equal(nov22Tick.h, MEDIUM_TICK);
    assert.equal(nov22Tick.fillStyle, "#5A5A52");

    // Fallback to palette.minor when palette.medium is omitted
    const fallbackRun = createRecordingCtx();
    drawRuler(fallbackRun.ctx, {
      width,
      height,
      level: "day",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: null,
      allMode: false,
      palette: TEST_PALETTE,
    });
    const fallbackTick = findTickNearX(fallbackRun.rects, nov22X, height);
    assert.equal(fallbackTick.h, MEDIUM_TICK);
    assert.equal(fallbackTick.fillStyle, TEST_PALETTE.minor);

    // Selected Monday Nov 23: "23" draws in accent and suppresses colliding Sunday "22"
    const nov23Idx = units.findIndex((u) => u.from === "2026-11-23");
    const selectedRun = createRecordingCtx();
    drawRuler(selectedRun.ctx, {
      width,
      height,
      level: "day",
      units,
      centers,
      offset,
      realFirst,
      realLast,
      selected: nov23Idx,
      allMode: false,
      palette: TEST_PALETTE,
    });

    const selLabel = selectedRun.texts.find((t) => t.text === "23");
    assert.ok(selLabel, "Expected selected label '23'");
    assert.equal(selLabel.fillStyle, TEST_PALETTE.accent);
    assert.equal(
      selectedRun.texts.some((t) => t.text === "22"),
      false,
      "Expected colliding Sunday '22' to be suppressed by priority-3 '23'",
    );
    assert.ok(selectedRun.texts.some((t) => t.text === "15"));
    assert.ok(selectedRun.texts.some((t) => t.text === "29"));
    assert.ok(selectedRun.texts.some((t) => t.text === "Dec"));
  });

  it("adds no priority-3 label for a selected week without a boundaryLabel", () => {
    const width = 396;
    const height = 26;
    const { units, realFirst, realLast } = buildRulerUnits("week", FIRST_KEY, "2026-11-24");
    const ppd = FIXED_PPD.week;
    const centers = units.map((u) => unitCenterDay(u, FIRST_KEY) * ppd);
    const midWeekIdx = units.findIndex((u) => u.from === "2026-11-15");
    assert.equal(units[midWeekIdx].monthStart, false);

    const { ctx, texts } = createRecordingCtx();
    drawRuler(ctx, {
      width,
      height,
      level: "week",
      units,
      centers,
      offset: centers[midWeekIdx],
      realFirst,
      realLast,
      selected: midWeekIdx,
      allMode: false,
      palette: TEST_PALETTE,
    });

    assert.equal(
      texts.some((t) => t.fillStyle === TEST_PALETTE.accent),
      false,
    );
  });
});
