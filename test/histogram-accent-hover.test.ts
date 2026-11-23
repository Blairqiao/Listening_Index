import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityChart } from "../src/components/views/ActivityChart";

const buckets = [
  { date: "2026-11-01", count: 12, startTime: "2026-11-01T00:00:00.000Z", endTime: "2026-11-01T23:59:59.999Z" },
  { date: "2026-11-02", count: 2, startTime: "2026-11-02T00:00:00.000Z", endTime: "2026-11-02T23:59:59.999Z" },
];

test("a highlighted Activity bar changes color on hover", () => {
  const html = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: buckets,
      onSelectBucket: () => {},
      visitorTimezone: "UTC",
    })
  );
  const hot = html.match(/<button[^>]*class="[^"]*\bbg-music-accent\b[^"]*"/);
  assert.ok(hot, "expected one highlighted bar");
  assert.match(hot[0], /hover:bg-music-accent-hover/);
});

test("the accent hover color is defined once as a theme color", () => {
  const css = fs.readFileSync(path.resolve(__dirname, "../src/app/globals.css"), "utf-8");
  assert.match(css, /--color-music-accent-hover:\s*color-mix\(in srgb, var\(--music-accent\)/);
});

for (const [file, cls] of [
  ["../src/components/views/search-view/HourChart.tsx", "hover:bg-music-accent-hover"],
  ["../src/components/views/search-view/DayOfWeekChart.tsx", "hover:bg-music-accent-hover"],
  ["../src/components/views/session-view/SessionHistogram.tsx", "group-hover:bg-music-accent-hover"],
] as const) {
  test(`${path.basename(file)} highlights hover on accent bars`, () => {
    const source = fs.readFileSync(path.resolve(__dirname, file), "utf-8");
    assert.ok(source.includes(cls), `${file} must use ${cls}`);
  });
}
