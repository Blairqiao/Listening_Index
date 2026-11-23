import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityChart } from "../src/components/views/ActivityChart";
import type { ActivityBucket } from "../src/lib/types";

const sampleBuckets: ActivityBucket[] = [
  {
    date: "2026-11-01",
    count: 12,
    startTime: "2026-11-01T00:00:00.000Z",
    endTime: "2026-11-01T23:59:59.999Z",
  },
  {
    date: "2026-11-02",
    count: 0,
    startTime: "2026-11-02T00:00:00.000Z",
    endTime: "2026-11-02T23:59:59.999Z",
  },
  {
    date: "2026-11-03",
    count: 5,
    startTime: "2026-11-03T00:00:00.000Z",
    endTime: "2026-11-03T23:59:59.999Z",
  },
];

test("uses named role=group when interactive controls exist, exposing buttons in accessibility tree", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: sampleBuckets,
      onSelectBucket: () => {},
      visitorTimezone: "UTC",
    })
  );

  // Container must be role="group" with aria-label="Activity cadence histogram"
  assert.match(
    markup,
    /<div\b[^>]*\brole="group"[^>]*\baria-label="Activity cadence histogram"[^>]*>/,
    "Interactive chart container must use role=group"
  );

  const buttonMatches = markup.match(/<button\b/g);
  assert.equal(buttonMatches?.length, sampleBuckets.length, "Must render one button per bucket");
  assert.ok(
    markup.includes('. Show this range"'),
    "Must include aria-label ending with . Show this range"
  );
  assert.ok(
    markup.includes("cursor-pointer"),
    "Must include cursor-pointer for clickable bars"
  );
  assert.ok(
    markup.includes("focus-visible:outline-music-accent"),
    "Must include focus-visible outline in accent color"
  );
});

test("keeps role=img for static charts with granularity='hour'", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "hour",
      activityCadence: sampleBuckets,
      onSelectBucket: () => {},
      visitorTimezone: "UTC",
    })
  );

  // Static chart container must keep role="img"
  assert.match(
    markup,
    /<div\b[^>]*\brole="img"[^>]*\baria-label="Activity cadence histogram"[^>]*>/,
    "Static hour chart container must use role=img"
  );

  const buttonMatches = markup.match(/<button\b/g);
  assert.equal(buttonMatches, null, "Must have no button elements when granularity is hour");
  assert.ok(
    markup.includes("cursor-default"),
    "Must keep cursor-default for hour bars"
  );
});

test("keeps role=img for static charts without onSelectBucket", () => {
  const markup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: sampleBuckets,
      visitorTimezone: "UTC",
    })
  );

  assert.match(
    markup,
    /<div\b[^>]*\brole="img"[^>]*\baria-label="Activity cadence histogram"[^>]*>/,
    "Static chart without onSelectBucket must use role=img"
  );

  const buttonMatches = markup.match(/<button\b/g);
  assert.equal(buttonMatches, null, "Must have no button elements without onSelectBucket");
});

test("zero-count bars are rendered as clickable buttons when onSelectBucket is set and granularity is not hour", () => {
  const zeroBuckets: ActivityBucket[] = [
    {
      date: "2026-11-02",
      count: 0,
      startTime: "2026-11-02T00:00:00.000Z",
      endTime: "2026-11-02T23:59:59.999Z",
    },
  ];

  const markup = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "month",
      activityCadence: zeroBuckets,
      onSelectBucket: () => {},
      visitorTimezone: "UTC",
    })
  );

  assert.ok(markup.includes("<button"), "Zero-count bar must render as a button");
  assert.ok(markup.includes("cursor-pointer"), "Zero-count button must have cursor-pointer");
});

test("wires native disabled attribute on buttons to isLoading reload state", () => {
  const markupLoading = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: sampleBuckets,
      onSelectBucket: () => {},
      isLoading: true,
      visitorTimezone: "UTC",
    })
  );

  const buttonsLoading = markupLoading.match(/<button\b[^>]*>/g);
  assert.ok(buttonsLoading && buttonsLoading.length === sampleBuckets.length);
  for (const btn of buttonsLoading) {
    // Assert actual HTML disabled attribute, not matching disabled: CSS classes
    assert.match(
      btn,
      /\sdisabled(?=[>\s=])/,
      "Must include scoped HTML disabled attribute on button when isLoading is true"
    );
  }

  const markupNotLoading = renderToStaticMarkup(
    React.createElement(ActivityChart, {
      granularity: "day",
      activityCadence: sampleBuckets,
      onSelectBucket: () => {},
      isLoading: false,
      visitorTimezone: "UTC",
    })
  );

  const buttonsNotLoading = markupNotLoading.match(/<button\b[^>]*>/g);
  assert.ok(buttonsNotLoading && buttonsNotLoading.length === sampleBuckets.length);
  for (const btn of buttonsNotLoading) {
    assert.doesNotMatch(
      btn,
      /\sdisabled(?=[>\s=])/,
      "Must not include HTML disabled attribute on button when isLoading is false"
    );
  }
});
