import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfigProvider } from "../src/context/ConfigContext";
import {
  ModeTabs,
  BASE_MODES,
  ADMIN_MODES,
  getAvailableModes,
} from "../src/components/listening-view/ModeTabs";
import { ControlRow } from "../src/components/listening-view/ControlRow";
import {
  MetricRibbon,
  getRibbonLabels,
} from "../src/components/listening-view/MetricRibbon";
import { sanitizeActiveMode } from "../src/components/listening-view/listening-helpers";

test("ModeTabs: Mode 4 Search tab configuration and rendering", () => {
  // Check BASE_MODES: last mode must be Mode 4 with "[ SEARCH ]" and abbrev "[ SRCH ]"
  const searchBaseTab = BASE_MODES.find((m) => (m.id) === 4);
  assert.ok(searchBaseTab, "BASE_MODES must include Mode 4");
  assert.equal(searchBaseTab?.label, "[ SEARCH ]");
  assert.equal(searchBaseTab?.abbrev, "[ SRCH ]");
  assert.equal(
    BASE_MODES[BASE_MODES.length - 1].id,
    4,
    "Mode 4 must be the last item of BASE_MODES"
  );

  // Check ADMIN_MODES: Mode 4 must precede Mode 3 (Live Player)
  const mode4Index = ADMIN_MODES.findIndex((m) => (m.id) === 4);
  const mode3Index = ADMIN_MODES.findIndex((m) => (m.id) === 3);
  assert.ok(mode4Index !== -1, "ADMIN_MODES must include Mode 4");
  assert.ok(mode3Index !== -1, "ADMIN_MODES must include Mode 3");
  assert.ok(
    mode4Index < mode3Index,
    "Mode 4 (Search) must precede Mode 3 (Live Player) in ADMIN_MODES"
  );

  // Check available modes for guest
  const guestModes = getAvailableModes(false);
  assert.ok(
    guestModes.some((m) => (m.id) === 4),
    "getAvailableModes(false) must include Mode 4"
  );
  assert.ok(
    !guestModes.some((m) => (m.id) === 3),
    "getAvailableModes(false) must exclude Mode 3"
  );

  // Server-rendered guest markup
  const guestMarkup = renderToStaticMarkup(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(ModeTabs, {
        activeMode: 4,
        onSelectMode: () => {},
        isAuthenticated: false,
      })
    )
  );
  assert.ok(guestMarkup.includes("[ SEARCH ]"), "Guest markup must contain [ SEARCH ]");
  assert.ok(guestMarkup.includes("[ SRCH ]"), "Guest markup must contain [ SRCH ]");
  assert.ok(
    !guestMarkup.includes("[ LIVE PLAYER ]"),
    "Guest markup must NOT contain [ LIVE PLAYER ]"
  );
  assert.ok(
    guestMarkup.includes('aria-selected="true"'),
    "Active Mode 4 tab must be selected"
  );

  // Server-rendered admin markup
  const adminMarkup = renderToStaticMarkup(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(ModeTabs, {
        activeMode: 4,
        onSelectMode: () => {},
        isAuthenticated: true,
      })
    )
  );
  assert.ok(adminMarkup.includes("[ SEARCH ]"), "Admin markup must contain [ SEARCH ]");
  assert.ok(adminMarkup.includes("[ LIVE PLAYER ]"), "Admin markup must contain [ LIVE PLAYER ]");
  assert.ok(
    adminMarkup.indexOf("[ SEARCH ]") < adminMarkup.indexOf("[ LIVE PLAYER ]"),
    "[ SEARCH ] must appear before [ LIVE PLAYER ] in admin markup"
  );
});

test("MetricRibbon: Mode 4 labels and rendering", () => {
  const labels = getRibbonLabels(4);
  assert.deepEqual(labels, ["PLAYS", "RANK", "FIRST PLAYED", "LAST PLAYED"]);

  const ribbonMarkup = renderToStaticMarkup(
    React.createElement(MetricRibbon, {
      mode: 4,
      metrics: ["--", "--", "--", "--"],
    })
  );
  assert.ok(ribbonMarkup.includes("PLAYS"), "Ribbon must render PLAYS");
  assert.ok(ribbonMarkup.includes("RANK"), "Ribbon must render RANK");
  assert.ok(ribbonMarkup.includes("FIRST PLAYED"), "Ribbon must render FIRST PLAYED");
  assert.ok(ribbonMarkup.includes("LAST PLAYED"), "Ribbon must render LAST PLAYED");
  assert.ok(
    !ribbonMarkup.includes("opacity-60 transition-opacity duration-150"),
    "MetricRibbon values must not be dimmed when isLoading is omitted or false"
  );

  const loadingMarkup = renderToStaticMarkup(
    React.createElement(MetricRibbon, {
      mode: 4,
      metrics: ["1,234", "#12", "JAN 2024", "TODAY"],
      isLoading: true,
    })
  );
  assert.ok(
    loadingMarkup.includes("opacity-60 transition-opacity duration-150"),
    "MetricRibbon values must have dimmed opacity classes when isLoading is true"
  );
});

test("ControlRow: Mode 4 scope label and profile range controls", () => {
  // Mode 4 default (Search mode, profileKind not set)
  const searchMarkup = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 4,
      range: "1w",
      onSelectRange: () => {},
      logStartDate: "2026-09-04T00:00:00.000Z",
      isSessionOpen: false,
      sessionTagTime: "",
    })
  );
  assert.ok(searchMarkup.includes("SEARCH"), "ControlRow mode 4 without profile must display SEARCH");
  assert.ok(
    !searchMarkup.includes("Time range filters"),
    "ControlRow mode 4 without profile must NOT render range buttons"
  );
  assert.ok(
    searchMarkup.includes("flex justify-between items-center h-[28px]"),
    "ControlRow mode 4 without profile must use single-line layout"
  );

  // Mode 4 track profile (profileKind: "track")
  const trackProfileMarkup = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 4,
      range: "1w",
      onSelectRange: () => {},
      logStartDate: "2026-09-04T00:00:00.000Z",
      isSessionOpen: false,
      sessionTagTime: "",
      profileKind: "track",
    })
  );
  assert.ok(
    trackProfileMarkup.includes("TRACK PROFILE"),
    "ControlRow mode 4 track profile must display TRACK PROFILE"
  );
  assert.ok(
    trackProfileMarkup.includes("Time range filters"),
    "ControlRow mode 4 track profile must render range buttons"
  );
  assert.ok(
    trackProfileMarkup.includes("flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:h-[28px]"),
    "ControlRow mode 4 track profile must use showsRanges layout"
  );

  // Mode 4 artist profile (profileKind: "artist")
  const artistProfileMarkup = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 4,
      range: "1w",
      onSelectRange: () => {},
      logStartDate: "2026-09-04T00:00:00.000Z",
      isSessionOpen: false,
      sessionTagTime: "",
      profileKind: "artist",
    })
  );
  assert.ok(
    artistProfileMarkup.includes("ARTIST PROFILE"),
    "ControlRow mode 4 artist profile must display ARTIST PROFILE"
  );
  assert.ok(
    artistProfileMarkup.includes("Time range filters"),
    "ControlRow mode 4 artist profile must render range buttons"
  );
  assert.ok(
    artistProfileMarkup.includes("flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center sm:h-[28px]"),
    "ControlRow mode 4 artist profile must use showsRanges layout"
  );
});

test("Search is public and Live Player is restricted to admins", () => {
  assert.equal(sanitizeActiveMode(4, false), 4);
  assert.equal(sanitizeActiveMode(4, true), 4);
  assert.equal(sanitizeActiveMode(3, false), 0);
  assert.equal(sanitizeActiveMode(3, true), 3);
});
