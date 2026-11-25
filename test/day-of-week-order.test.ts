import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DayOfWeekChart } from "../src/components/views/search-view/DayOfWeekChart";

test("DayOfWeekChart renders Sunday first while preserving Monday-first data indexes", () => {
  const counts = [1, 2, 3, 4, 5, 6, 7]; // Mon=1 .. Sun=7
  const markup = renderToStaticMarkup(
    React.createElement(DayOfWeekChart, { counts }),
  );

  // Aria label names the peak day (index 6 = Sun)
  assert.ok(
    markup.includes('aria-label="Plays by day of week, peak Sun"'),
    "aria-label should name peak Sun",
  );

  // First bar should be Sun with 7 plays
  const titles = [...markup.matchAll(/title="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(titles, [
    "Sun · 7 plays",
    "Mon · 1 plays",
    "Tue · 2 plays",
    "Wed · 3 plays",
    "Thu · 4 plays",
    "Fri · 5 plays",
    "Sat · 6 plays",
  ]);

  // Label row should read Sun, Mon, Tue, Wed, Thu, Fri, Sat
  const labels = [...markup.matchAll(/<span>(Sun|Mon|Tue|Wed|Thu|Fri|Sat)<\/span>/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(labels, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
});
