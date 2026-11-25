import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ZoomRuler,
  nextOnToday,
} from "../src/components/listening-view/zoom-ruler/ZoomRuler";
import { presetRange, unitWindow } from "../src/lib/range";

const BASE_PROPS = {
  onSelectRange: () => {},
  firstKey: "2019-03-01",
  todayKey: "2026-11-22",
};

test("ZoomRuler renders Week label, zoom buttons, Today, and group aria-label for a week window", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ZoomRuler, {
      ...BASE_PROPS,
      range: unitWindow("2026-11-22", "week"),
    }),
  );

  assert.ok(markup.includes('role="group"'), "Root must have role=group");
  assert.ok(
    markup.includes('aria-label="Time range filters"'),
    "Root must have aria-label Time range filters",
  );
  assert.ok(markup.includes("Week"), "Must render unit word Week");
  assert.ok(markup.includes('aria-label="Zoom out"'), "Must render Zoom out button");
  assert.ok(markup.includes('aria-label="Zoom in"'), "Must render Zoom in button");
  assert.ok(
    markup.includes('aria-label="Jump to today"'),
    "Must render Jump to today button",
  );
  const todayBtn = markup.match(/<button[^>]*aria-label="Jump to today"[^>]*>/)?.[0] ?? "";
  assert.ok(!todayBtn.includes("invisible"), "Jump to today stays visible while on today");
  assert.ok(!todayBtn.includes("aria-hidden"), "Jump to today stays in the accessibility tree");
  assert.match(todayBtn, /\sdisabled(?=[>\s=])/, "Jump to today is disabled while on today");
  assert.ok(markup.includes("<canvas"), "Must render canvas element");
  assert.ok(markup.includes('aria-live="polite"'), "Unit word must have aria-live=polite");
  assert.ok(!markup.includes("border-[#26261F]"), "Variant A tape must have no frame border");
  assert.ok(!markup.includes("bg-[#0B0B0A]"), "Variant A tape must have no box background");
});

test("ZoomRuler renders All and disables Zoom out button for presetRange('all')", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ZoomRuler, {
      ...BASE_PROPS,
      range: presetRange("all"),
    }),
  );

  assert.ok(markup.includes("All"), "Must render unit word All");
  const zoomOutBtn = markup.match(/<button[^>]*aria-label="Zoom out"[^>]*>/);
  assert.ok(zoomOutBtn, "Must find Zoom out button");
  assert.match(zoomOutBtn[0], /\sdisabled=""/, "Zoom out button must be disabled at All");

  const zoomInBtn = markup.match(/<button[^>]*aria-label="Zoom in"[^>]*>/);
  assert.ok(zoomInBtn, "Must find Zoom in button");
  assert.doesNotMatch(zoomInBtn[0], /\sdisabled=""/, "Zoom in button must remain enabled at All");
});

test("ZoomRuler shows the level word rather than custom span text for a custom 10-day window", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ZoomRuler, {
      ...BASE_PROPS,
      range: { kind: "window", from: "2026-11-03", to: "2026-11-12" },
    }),
  );

  assert.ok(markup.includes("Month"), "10-day custom window must show its level word Month");
  assert.ok(
    !markup.includes("Nov 3–12, 2026"),
    "Ruler must not show custom range text in place of the level word",
  );
});

test("ZoomRuler renders a provided label node", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ZoomRuler, {
      ...BASE_PROPS,
      range: unitWindow("2026-11-24", "week"),
      label: React.createElement("span", null, "Nov 22–28, 2026"),
    }),
  );

  assert.ok(markup.includes("Nov 22–28, 2026"), "Must render provided label node");
});

test("ZoomRuler disables all buttons when disabled prop is true", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ZoomRuler, {
      ...BASE_PROPS,
      range: unitWindow("2026-11-22", "week"),
      disabled: true,
    }),
  );

  const buttons = markup.match(/<button[^>]*>/g) ?? [];
  assert.equal(buttons.length, 3, "Must render Zoom out, Zoom in, and Today buttons");
  for (const btn of buttons) {
    assert.match(btn, /\sdisabled=""/, `Expected button to be disabled: ${btn}`);
  }
  assert.ok(markup.includes("opacity-60"), "Disabled root must include opacity-60");
  assert.ok(markup.includes("cursor-wait"), "Disabled root must include cursor-wait");
});

test("ZoomRuler SSR markup depends only on range and never on todayKey", () => {
  const a = renderToStaticMarkup(
    React.createElement(ZoomRuler, {
      ...BASE_PROPS,
      todayKey: "2026-11-22",
      range: unitWindow("2026-11-22", "month"),
    }),
  );
  const b = renderToStaticMarkup(
    React.createElement(ZoomRuler, {
      ...BASE_PROPS,
      todayKey: "2026-11-23",
      range: unitWindow("2026-11-22", "month"),
    }),
  );
  assert.equal(a, b, "SSR markup must not depend on todayKey");
});

test("nextOnToday keeps the Today icon state unchanged while the ruler is zooming", () => {
  const todayWeek = { from: "2026-11-22", to: "2026-11-28" };
  const settled = {
    settledLevel: "week" as const,
    isZooming: false,
    exact: true,
    selectedUnit: todayWeek,
    todayKey: "2026-11-24",
  };

  assert.equal(nextOnToday(false, settled), true, "settled on today's week hides the icon");
  assert.equal(
    nextOnToday(false, { ...settled, selectedUnit: { from: "2026-11-15", to: "2026-11-21" } }),
    false,
    "settled away from today shows the icon",
  );
  assert.equal(
    nextOnToday(true, { ...settled, isZooming: true }),
    true,
    "a zoom step started on today must not flash the icon",
  );
  assert.equal(
    nextOnToday(false, { ...settled, isZooming: true }),
    false,
    "a zoom step started away from today keeps the icon",
  );
  assert.equal(
    nextOnToday(false, { ...settled, settledLevel: "all", exact: false, selectedUnit: undefined }),
    true,
    "the All level hides the icon",
  );
});
