import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readSrc = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

// Load all at once

test("gateCalendarOnTaste holds the calendar until taste settles on first load", async () => {
  const { gateCalendarOnTaste } = await import("../src/components/listening-view/calendarGate");
  const cal = { days: [] };
  const taste = { phases: [] };

  assert.deepEqual(
    gateCalendarOnTaste({ data: cal, status: "ready" }, { data: null, status: "loading" }),
    { data: null, isLoading: true },
    "calendar ready but taste in flight keeps the skeleton",
  );
  assert.deepEqual(
    gateCalendarOnTaste({ data: null, status: "loading" }, { data: taste, status: "ready" }),
    { data: null, isLoading: true },
  );
  assert.deepEqual(
    gateCalendarOnTaste({ data: cal, status: "ready" }, { data: taste, status: "ready" }),
    { data: cal, isLoading: false },
  );
  assert.deepEqual(
    gateCalendarOnTaste({ data: cal, status: "ready" }, { data: null, status: "error" }),
    { data: cal, isLoading: false },
    "a taste error must not hide the calendar",
  );
  assert.deepEqual(
    gateCalendarOnTaste({ data: cal, status: "loading" }, { data: taste, status: "loading" }),
    { data: cal, isLoading: false },
    "a refresh keeps the previous content on screen",
  );
  assert.deepEqual(
    gateCalendarOnTaste({ data: null, status: "idle" }, { data: null, status: "idle" }),
    { data: null, isLoading: true },
  );
});

test("ListeningView passes gated calendar data to CalendarView", () => {
  const src = readSrc("src/components/ListeningView.tsx");
  assert.ok(src.includes("gateCalendarOnTaste(calendar, taste)"));
  assert.match(src, /<CalendarView\s+data=\{calendarGate\.data\}\s+isLoading=\{calendarGate\.isLoading\}/);
});

test("Calendar ribbon numbers wait for the same gate as the calendar", () => {
  const src = readSrc("src/components/ListeningView.tsx");
  const start = src.indexOf("const calendarMetrics");
  assert.ok(start > 0, "calendarMetrics must exist");
  const block = src.slice(start, src.indexOf("const metricByMode", start));
  assert.ok(block.includes("calendarGate.data"), "ribbon must read the gated calendar data");
  assert.ok(!/\bcalendar\.data\b/.test(block), "ribbon must not read the ungated calendar data");
  assert.ok(
    src.indexOf("const calendarGate =") < start,
    "the gate must be computed before the ribbon metrics",
  );
});

test("withRevealCap resolves with the task or after the cap, whichever is first", async () => {
  const { withRevealCap } = await import("../src/lib/motion");
  const fast = await withRevealCap(Promise.resolve("done"), 50);
  assert.equal(fast, "done");

  const started = Date.now();
  const slow = await withRevealCap(new Promise((r) => setTimeout(() => r("late"), 500)), 40);
  assert.equal(slow, undefined);
  assert.ok(Date.now() - started < 300, "cap must win over a slow task");

  const failed = await withRevealCap(Promise.reject(new Error("x")), 40);
  assert.equal(failed, undefined, "a failed task must not block the reveal");
});

test("UploadModal waits for enrichment progress before revealing the panel", () => {
  const src = readSrc("src/components/modals/upload-modal/UploadModal.tsx");
  assert.ok(src.includes("withRevealCap("), "open path must hold the reveal for the first enrichment fetch");
  assert.ok(src.includes("ENRICHMENT_REVEAL_CAP_MS"));
  assert.match(src, /data-enrichment-slot/, "a slow fetch reserves the card's space");
});
