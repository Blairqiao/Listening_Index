import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlRow } from "../src/components/listening-view/ControlRow";
import { compactDate, formatStreamLogDateSpan } from "../src/lib/format-utils";
import { presetRange, unitWindow } from "../src/lib/range";
import type { ProfileHistoryEntry } from "../src/lib/search-types";

test("formatStreamLogDateSpan formats date ranges correctly", () => {
  // 1. Multi-day span
  const span = formatStreamLogDateSpan(
    "2026-10-24T10:00:00.000Z",
    "2026-10-26T22:00:00.000Z",
    "UTC"
  );
  assert.equal(span, "24 Oct – 26 Oct");

  // 2. Same-day entries
  const sameDay = formatStreamLogDateSpan(
    "2026-10-26T08:00:00.000Z",
    "2026-10-26T22:00:00.000Z",
    "UTC"
  );
  assert.equal(sameDay, "26 Oct");

  // 3. Fallbacks
  assert.equal(formatStreamLogDateSpan(undefined, undefined), "Stream log");
});

test("ControlRow component supports dynamic scope labels for Stream Log, Sessions, and Live Player", () => {
  const controlRowPath = path.resolve(__dirname, "../src/components/listening-view/ControlRow.tsx");
  const content = fs.readFileSync(controlRowPath, "utf-8");

  // Mode 1: uses dateSpan / streamLogDateSpan
  assert.ok(
    content.includes("dateSpan") || content.includes("streamLogDateSpan"),
    "ControlRow must accept streamLogDateSpan or dateSpan prop for Mode 1"
  );

  // Mode 2: renders session index/total (e.g. SESSION 01 / 20)
  assert.ok(
    content.includes("sessionIndex") || content.includes("sessionNumber"),
    "ControlRow must accept session index or session number prop for Mode 2"
  );

  // Mode 3: renders device telemetry
  assert.ok(
    content.includes("activeDevice") || content.includes("deviceName"),
    "ControlRow must accept activeDevice or deviceName prop for Mode 3"
  );

});

test("ControlRow shows the Album profile label and the profile back destination", () => {
  const props = {
    mode: 4 as const,
    range: presetRange("1y"),
    onSelectRange: () => {},
    firstKey: "2024-08-14",
    todayKey: "2026-11-24",
    logStartDate: "",
    isSessionOpen: false,
    sessionTagTime: "",
    profileKind: "album" as const,
  };
  assert.match(renderToStaticMarkup(React.createElement(ControlRow, props)), />Album profile</);

  for (const [returnsTo, label] of [["album", "album"], ["artist", "artist"], [null, "search"]] as const) {
    const markup = renderToStaticMarkup(React.createElement(ControlRow, {
      ...props,
      profileKind: returnsTo === "album" ? "track" : "album",
      returnsTo,
      onProfileBack: () => {},
    }));
    assert.match(markup, new RegExp(`<button[^>]*>← Back to ${label}</button>`));
  }
});

test("LivePlayerView houses context selector inside playback controls without redundant middle device band", () => {
  const livePlayerPath = path.resolve(__dirname, "../src/components/views/live-player-view/LivePlayerView.tsx");
  const content = fs.readFileSync(livePlayerPath, "utf-8");

  // Must not have the old separate "Device & Playback Context Row"
  assert.ok(
    !content.includes("Device & Playback Context Row"),
    "LivePlayerView must remove redundant middle device & context row"
  );

  // Must render context selector in transport/controls area
  assert.ok(
    content.includes("selectContext"),
    "LivePlayerView must preserve selectContext"
  );
});

test("ControlRow renders breadcrumb trail for multi-hop profile history with truncation and jump handlers", () => {
  const history: ProfileHistoryEntry[] = [
    { target: { kind: "artist", key: "radiohead" }, range: presetRange("1y"), name: "Radiohead" },
    { target: { kind: "album", key: "in-rainbows" }, range: presetRange("1y"), name: "In Rainbows" },
  ];

  let jumpedIndex: number | null = null;
  let returnedToSearch = false;

  const props = {
    mode: 4 as const,
    range: presetRange("1y"),
    onSelectRange: () => {},
    firstKey: "2024-08-14",
    todayKey: "2026-11-24",
    logStartDate: "",
    isSessionOpen: false,
    sessionTagTime: "",
    profileKind: "track" as const,
    profileHistory: history,
    onJumpToHistory: (index: number) => { jumpedIndex = index; },
    onReturnToSearch: () => { returnedToSearch = true; },
  };

  const markup = renderToStaticMarkup(React.createElement(ControlRow, props));

  // Breadcrumbs navigation wrapper
  assert.ok(markup.includes('<nav aria-label="Profile navigation"'), "Must render nav with aria-label");
  assert.ok(markup.includes("flex items-center gap-1.5 min-w-0 overflow-hidden"), "Nav must have overflow/gap discipline");

  // Desktop search button and ancestors
  assert.ok(markup.includes("← Search"), "Must render ← Search on desktop");
  assert.ok(markup.includes("Radiohead"), "Must render ancestor name Radiohead");
  assert.ok(markup.includes("In Rainbows"), "Must render direct parent name In Rainbows");
  assert.ok(markup.includes("max-w-[140px] truncate"), "Must truncate ancestor button text cleanly");
  assert.ok(markup.includes("text-[#A0A099] hover:text-[#EDEDE8]"), "Direct parent must be styled brighter");

  // Mobile layout
  assert.ok(markup.includes("← In Rainbows"), "Mobile view must show ← <DIRECT PARENT NAME>");
  assert.ok(markup.includes(">Search</button>"), "Mobile view must show subtle Search escape link");

  // Range controls should not shrink
  assert.ok(markup.includes("shrink-0"), "ControlRow range container must have shrink-0");

  // Verify click handlers through element tree
  interface VNode {
    type?: unknown;
    props?: {
      children?: unknown;
      onClick?: () => void;
    };
  }

  function findButtons(node: unknown): VNode[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(findButtons);
    const elem = node as VNode;
    if (elem.type === "button") return [elem];
    const children = Array.isArray(elem.props?.children)
      ? elem.props?.children
      : elem.props?.children
      ? [elem.props.children]
      : [];
    return children.flatMap(findButtons);
  }

  const buttons = findButtons(ControlRow(props));
  const searchBtn = buttons.find((b) => b.props?.children === "← Search");
  assert.ok(searchBtn, "Must find desktop ← Search button");
  searchBtn.props?.onClick?.();
  assert.equal(returnedToSearch, true, "Clicking ← Search must call onReturnToSearch");

  const radioheadBtn = buttons.find((b) => b.props?.children === "Radiohead");
  assert.ok(radioheadBtn, "Must find Radiohead ancestor button");
  radioheadBtn.props?.onClick?.();
  assert.equal(jumpedIndex, 0, "Clicking Radiohead must jump to index 0");

  const inRainbowsBtn = buttons.find((b) => b.props?.children === "In Rainbows");
  assert.ok(inRainbowsBtn, "Must find In Rainbows ancestor button");
  inRainbowsBtn.props?.onClick?.();
  assert.equal(jumpedIndex, 1, "Clicking In Rainbows must jump to index 1");

  // Fallback to onJumpToHistory(-1) when onReturnToSearch is omitted
  let fallbackJumpedIndex: number | null = null;
  const fallbackTree = ControlRow({
    ...props,
    onReturnToSearch: undefined,
    onJumpToHistory: (idx: number) => { fallbackJumpedIndex = idx; },
  });
  const fallbackSearchBtn = findButtons(fallbackTree).find((b) => b.props?.children === "← Search");
  fallbackSearchBtn?.props?.onClick?.();
  assert.equal(fallbackJumpedIndex, -1, "Clicking ← Search without onReturnToSearch must call onJumpToHistory(-1)");
});

test("ControlRow renders ellipsis when profile history exceeds 2 ancestors", () => {
  const history: ProfileHistoryEntry[] = [
    { target: { kind: "artist", key: "artist-1" }, range: presetRange("1y"), name: "First Artist" },
    { target: { kind: "album", key: "album-1" }, range: presetRange("1y"), name: "Middle Album" },
    { target: { kind: "track", key: "track-1" }, range: presetRange("1y"), name: "Parent Track" },
  ];

  const markup = renderToStaticMarkup(React.createElement(ControlRow, {
    mode: 4,
    range: presetRange("1y"),
    onSelectRange: () => {},
    firstKey: "2024-08-14",
    todayKey: "2026-11-24",
    logStartDate: "",
    isSessionOpen: false,
    sessionTagTime: "",
    profileKind: "artist",
    profileHistory: history,
    onJumpToHistory: () => {},
    onReturnToSearch: () => {},
  }));

  // Ellipsis should be present
  assert.ok(markup.includes("…"), "Must render ellipsis when history exceeds 2 ancestors");
  // First ancestor should not be in visible trail, but last 2 must be
  assert.ok(!markup.includes("First Artist"), "First ancestor beyond last 2 should be collapsed");
  assert.ok(markup.includes("Middle Album"), "Second ancestor should be visible");
  assert.ok(markup.includes("Parent Track"), "Direct parent should be visible");
});

test("ControlRow in mode 0 renders the zoom ruler without preset buttons or back chip", () => {
  const windowProps = {
    mode: 0 as const,
    range: { kind: "window" as const, from: "2026-11-01", to: "2026-11-30" },
    onSelectRange: () => {},
    firstKey: "2024-08-14",
    todayKey: "2026-11-24",
    logStartDate: "14 AUG 2024",
    isSessionOpen: false,
    sessionTagTime: "",
  };

  const windowMarkup = renderToStaticMarkup(React.createElement(ControlRow, windowProps));
  assert.ok(windowMarkup.includes("Time range filters"), "Must render Time range filters group");
  assert.ok(windowMarkup.includes("Zoom out"), "Must render Zoom out button");
  assert.ok(!windowMarkup.includes(">1w</button>"), "Must not render 1w preset button");
  assert.ok(!windowMarkup.includes("← "), "Must not render drill-back chip");

  const presetMarkup = renderToStaticMarkup(
    React.createElement(ControlRow, {
      ...windowProps,
      range: presetRange("1w"),
    })
  );
  assert.ok(presetMarkup.includes("Time range filters"), "Must render Time range filters group");
  assert.ok(presetMarkup.includes("Zoom out"), "Must render Zoom out button");
  assert.ok(!presetMarkup.includes(">1w</button>"), "Must not render 1w preset button");
  assert.ok(!presetMarkup.includes("← "), "Must not render drill-back chip");
});

test("ControlRow in mode 4 renders the ruler only when a profile is active", () => {
  const base = {
    mode: 4 as const,
    range: presetRange("1w"),
    onSelectRange: () => {},
    firstKey: "2024-08-14",
    todayKey: "2026-11-24",
    logStartDate: "14 AUG 2024",
    isSessionOpen: false,
    sessionTagTime: "",
  };

  const searchMarkup = renderToStaticMarkup(React.createElement(ControlRow, base));
  assert.ok(!searchMarkup.includes("Time range filters"), "Search mode must not render ruler");
  assert.ok(!searchMarkup.includes("Zoom out"), "Search mode must not render Zoom out");

  const profileMarkup = renderToStaticMarkup(
    React.createElement(ControlRow, { ...base, profileKind: "track" })
  );
  assert.ok(profileMarkup.includes("Time range filters"), "Profile mode must render ruler");
  assert.ok(profileMarkup.includes("Zoom out"), "Profile mode must render Zoom out");
  assert.ok(!profileMarkup.includes(">1w</button>"), "Profile mode must not render 1w preset button");
});

test("ControlRow in mode 0 renders the active range label and switches to Since on all", () => {
  const base = {
    mode: 0 as const,
    onSelectRange: () => {},
    firstKey: "2026-09-04",
    todayKey: "2026-11-24",
    logStartDate: "2026-09-04",
    isSessionOpen: false,
    sessionTagTime: "",
  };

  const weekMarkup = renderToStaticMarkup(
    React.createElement(ControlRow, {
      ...base,
      range: unitWindow("2026-11-24", "week"),
    }),
  );
  assert.ok(
    weekMarkup.includes("Nov 22–28, 2026"),
    "Mode 0 week window must render formatted range label Nov 22–28, 2026",
  );
  assert.ok(
    !weekMarkup.includes("Since "),
    "Mode 0 non-all range must not render the static Since scope label",
  );
  assert.match(
    weekMarkup,
    /<span class="font-mono text-\[12px\] whitespace-nowrap text-\[#5A5A55\]">Nov 22–28, 2026/,
    "Mode 0 range label must use the same muted color as the Since label",
  );

  const allMarkup = renderToStaticMarkup(
    React.createElement(ControlRow, {
      ...base,
      range: presetRange("all"),
    }),
  );
  assert.ok(
    allMarkup.includes(`Since ${compactDate("2026-09-04")}`),
    "Mode 0 all preset must render Since followed by compactDate(logStartDate)",
  );
});

test("ControlRow in mode 5 names the calendar selection in the muted scope label and falls back to Since", () => {
  const base = {
    mode: 5 as const,
    range: presetRange("all"),
    onSelectRange: () => {},
    firstKey: "2022-01-29",
    todayKey: "2026-11-25",
    logStartDate: "2022-01-29",
    isSessionOpen: false,
    sessionTagTime: "",
  };

  const selected = renderToStaticMarkup(
    React.createElement(ControlRow, {
      ...base,
      calendarSelection: { from: "2022-10-17", to: "2022-10-17" },
    }),
  );
  assert.match(
    selected,
    /<span class="font-mono text-\[12px\] text-\[#5A5A55\] whitespace-nowrap sm:mr-4 ">Oct 17, 2022/,
    "Mode 5 must name the selection in the same muted scope slot as every other page",
  );
  assert.ok(!selected.includes("Since "), "Mode 5 with a selection must not claim the whole history");
  assert.ok(selected.includes("Less") && selected.includes("More"), "Mode 5 keeps the legend");

  const empty = renderToStaticMarkup(
    React.createElement(ControlRow, { ...base, calendarSelection: null }),
  );
  assert.ok(empty.includes(`Since ${compactDate("2022-01-29")}`), "Mode 5 without a selection falls back to Since");
});

test("ControlRow in mode 0 passes Random to the ruler and holds it until calendar days arrive", () => {
  const base = {
    mode: 0 as const,
    range: unitWindow("2026-11-24", "week"),
    onSelectRange: () => {},
    firstKey: "2026-09-04",
    todayKey: "2026-11-24",
    logStartDate: "2026-09-04",
    isSessionOpen: false,
    sessionTagTime: "",
  };
  const ready = renderToStaticMarkup(
    React.createElement(ControlRow, { ...base, onRandomRange: () => {}, randomRangeReady: true }),
  );
  const btn = ready.match(/<button[^>]*aria-label="Random week"[^>]*>/)?.[0];
  assert.ok(btn, "Overview control row renders Random");
  assert.doesNotMatch(btn, /\sdisabled(?=[>\s=])/);

  const loading = renderToStaticMarkup(
    React.createElement(ControlRow, { ...base, onRandomRange: () => {}, randomRangeReady: false }),
  );
  assert.match(loading.match(/<button[^>]*aria-label="Random week"[^>]*>/)?.[0] ?? "", /\sdisabled(?=[>\s=])/);
});
