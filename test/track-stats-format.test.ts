import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCatalogPercentile,
  formatRankDisplay,
  formatPlaysDisplay,
} from "../src/lib/format-utils";

test("formatCatalogPercentile returns NEW for unranked or invalid inputs", () => {
  assert.equal(formatCatalogPercentile(null, 1000), "NEW");
  assert.equal(formatCatalogPercentile(0, 1000), "NEW");
  assert.equal(formatCatalogPercentile(-1, 1000), "NEW");
  assert.equal(formatCatalogPercentile(10, 0), "NEW");
  assert.equal(formatCatalogPercentile(10, -50), "NEW");
});

test("formatCatalogPercentile formats sub-1% percentiles with 1 decimal place", () => {
  // 4 / 1000 = 0.4%
  assert.equal(formatCatalogPercentile(4, 1000), "TOP 0.4%");
  // 1 / 1000 = 0.1%
  assert.equal(formatCatalogPercentile(1, 1000), "TOP 0.1%");
  // 9 / 1000 = 0.9%
  assert.equal(formatCatalogPercentile(9, 1000), "TOP 0.9%");
});

test("formatCatalogPercentile formats >=1% percentiles rounded to integer", () => {
  // 1 / 50 = 2%
  assert.equal(formatCatalogPercentile(1, 50), "TOP 2%");
  // 50 / 1000 = 5%
  assert.equal(formatCatalogPercentile(50, 1000), "TOP 5%");
  // 154 / 1000 = 15.4% -> rounds to 15%
  assert.equal(formatCatalogPercentile(154, 1000), "TOP 15%");
  // 156 / 1000 = 15.6% -> rounds to 16%
  assert.equal(formatCatalogPercentile(156, 1000), "TOP 16%");
});

test("formatRankDisplay returns NEW for unranked or non-positive rank", () => {
  assert.equal(formatRankDisplay(null, 1000, "rank"), "NEW");
  assert.equal(formatRankDisplay(null, 1000, "percentile"), "NEW");
  assert.equal(formatRankDisplay(0, 1000, "rank"), "NEW");
  assert.equal(formatRankDisplay(0, 1000, "percentile"), "NEW");
  assert.equal(formatRankDisplay(-5, 1000, "rank"), "NEW");
});

test("formatRankDisplay formats rank with # prefix when format is rank", () => {
  assert.equal(formatRankDisplay(1, 1000, "rank"), "#1");
  assert.equal(formatRankDisplay(42, 1000, "rank"), "#42");
  assert.equal(formatRankDisplay(350, 1000, "rank"), "#350");
});

test("formatRankDisplay delegates to formatCatalogPercentile when format is percentile", () => {
  assert.equal(formatRankDisplay(4, 1000, "percentile"), "TOP 0.4%");
  assert.equal(formatRankDisplay(50, 1000, "percentile"), "TOP 5%");
});

test("formatPlaysDisplay formats singular, plural, and zero play counts with comma separation", () => {
  assert.equal(formatPlaysDisplay(0), "0 PLAYS");
  assert.equal(formatPlaysDisplay(1), "1 PLAY");
  assert.equal(formatPlaysDisplay(2), "2 PLAYS");
  assert.equal(formatPlaysDisplay(42), "42 PLAYS");
  assert.equal(formatPlaysDisplay(1250), "1,250 PLAYS");
  assert.equal(formatPlaysDisplay(1000000), "1,000,000 PLAYS");
});
