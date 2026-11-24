import { test } from "node:test";
import assert from "node:assert/strict";
import { parseModeParam, buildListeningUrlSearch } from "../src/components/listening-view/listening-helpers";
import { getRibbonLabels } from "../src/components/listening-view/MetricRibbon";
import { BASE_MODES } from "../src/components/listening-view/ModeTabs";
import { presetRange } from "../src/lib/range";

test("parseModeParam accepts valid modes 0-5 and rejects invalid values", () => {
  assert.equal(parseModeParam("5"), 5);
  assert.equal(parseModeParam("0"), 0);
  assert.equal(parseModeParam("1"), 1);
  assert.equal(parseModeParam("2"), 2);
  assert.equal(parseModeParam("3"), 3);
  assert.equal(parseModeParam("4"), 4);

  assert.equal(parseModeParam("6"), null);
  assert.equal(parseModeParam("05"), null);
  assert.equal(parseModeParam(""), null);
  assert.equal(parseModeParam(null), null);
  assert.equal(parseModeParam(undefined), null);
});

test("buildListeningUrlSearch sets mode=5 and preserves range=1m", () => {
  const dummyState = {
    activeMode: 5 as const,
    overviewRange: presetRange("1m"),
    profileTarget: null,
    profileRange: presetRange("all"),
  };
  const url = buildListeningUrlSearch("?range=1m", dummyState);
  const params = new URLSearchParams(url.startsWith("?") ? url.slice(1) : url);
  assert.equal(params.get("mode"), "5");
  assert.equal(params.get("range"), "1m");
});

test("buildListeningUrlSearch drops mode when switching back to mode 0", () => {
  const dummyState = {
    activeMode: 0 as const,
    overviewRange: presetRange("all"),
    profileTarget: null,
    profileRange: presetRange("all"),
  };
  const url = buildListeningUrlSearch("?mode=5", dummyState);
  const params = new URLSearchParams(url.startsWith("?") ? url.slice(1) : url);
  assert.equal(params.has("mode"), false);
});

test("getRibbonLabels(5) returns the four calendar labels", () => {
  const labels = getRibbonLabels(5);
  assert.deepEqual(labels, ["Plays", "Active days", "Daily avg", "Peak day"]);
});

test("BASE_MODES ids are [0, 1, 2, 5, 4]", () => {
  const ids = BASE_MODES.map((m) => m.id);
  assert.deepEqual(ids, [0, 1, 2, 5, 4]);
});
