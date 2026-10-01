import assert from "node:assert";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getRibbonLabels, MetricRibbon } from "../src/components/MetricRibbon";

test("getRibbonLabels returns archive telemetry labels for Mode 3 by default", () => {
  const labels = getRibbonLabels(3);
  assert.deepStrictEqual(labels, ["TRACK RANK", "TRACK PLAYS", "ARTIST RANK", "ARTIST PLAYS"]);
});

test("getRibbonLabels maintains TRACK RANK and ARTIST RANK labels for Mode 3 even when toggled to percentile", () => {
  const trackPercentileLabels = getRibbonLabels(3, "minutes", "percentile", "rank");
  assert.deepStrictEqual(trackPercentileLabels, ["TRACK RANK", "TRACK PLAYS", "ARTIST RANK", "ARTIST PLAYS"]);

  const artistPercentileLabels = getRibbonLabels(3, "minutes", "rank", "percentile");
  assert.deepStrictEqual(artistPercentileLabels, ["TRACK RANK", "TRACK PLAYS", "ARTIST RANK", "ARTIST PLAYS"]);

  const bothPercentileLabels = getRibbonLabels(3, "minutes", "percentile", "percentile");
  assert.deepStrictEqual(bothPercentileLabels, ["TRACK RANK", "TRACK PLAYS", "ARTIST RANK", "ARTIST PLAYS"]);
});


test("getRibbonLabels preserves labels for Mode 0, 1, 2", () => {
  assert.deepStrictEqual(getRibbonLabels(0, "minutes"), ["MINUTES", "TRACKS", "ARTISTS", "DAILY AVG"]);
  assert.deepStrictEqual(getRibbonLabels(0, "hours"), ["HOURS", "TRACKS", "ARTISTS", "DAILY AVG"]);
  assert.deepStrictEqual(getRibbonLabels(1), ["TOTAL PLAYS", "UNIQUE TRACKS", "UNIQUE ARTISTS", "CURRENT STREAK"]);
  assert.deepStrictEqual(getRibbonLabels(2), ["SESSION RUNTIME", "TOTAL TRACKS", "UNIQUE ARTISTS", "START TIME"]);
});

test("MetricRibbon renders interactive buttons for Mode 3 cells 0 and 2 when toggle handlers provided", () => {
  const html = renderToStaticMarkup(
    React.createElement(MetricRibbon, {
      mode: 3,
      metrics: ["#42", "128 plays", "#7", "420 plays"],
      trackRankFormat: "rank",
      artistRankFormat: "rank",
      onToggleTrackRank: () => {},
      onToggleArtistRank: () => {},
    })
  );

  assert.match(html, /role="button"/);
  assert.match(html, /aria-label="Toggle track rank format between rank position and percentile"/);
  assert.match(html, /aria-label="Toggle artist rank format between rank position and percentile"/);
  assert.match(html, /title="Click to toggle between rank and percentile"/);
  assert.match(html, /TRACK RANK/);
  assert.match(html, /ARTIST RANK/);
});

test("MetricRibbon renders non-interactive cells for Mode 3 when toggle handlers not provided", () => {
  const html = renderToStaticMarkup(
    React.createElement(MetricRibbon, {
      mode: 3,
      metrics: ["#42", "128 plays", "#7", "420 plays"],
    })
  );

  assert.doesNotMatch(html, /role="button"/);
  assert.doesNotMatch(html, /aria-label="Toggle track rank format/);
  assert.doesNotMatch(html, /aria-label="Toggle artist rank format/);
});
