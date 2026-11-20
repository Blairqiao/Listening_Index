import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlRow } from "../src/components/listening-view/ControlRow";
import { formatStreamLogDateSpan } from "../src/lib/format-utils";
import type { ProfileHistoryEntry } from "../src/lib/search-types";

test("formatStreamLogDateSpan formats date ranges correctly", () => {
  // 1. Multi-day span
  const span = formatStreamLogDateSpan(
    "2026-10-24T10:00:00.000Z",
    "2026-10-26T22:00:00.000Z",
    "UTC"
  );
  assert.equal(span, "24 OCT – 26 OCT");

  // 2. Same-day entries
  const sameDay = formatStreamLogDateSpan(
    "2026-10-26T08:00:00.000Z",
    "2026-10-26T22:00:00.000Z",
    "UTC"
  );
  assert.equal(sameDay, "26 OCT");

  // 3. Fallbacks
  assert.equal(formatStreamLogDateSpan(undefined, undefined), "STREAM LOG");
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

  // Mode 3 layout button hidden on mobile (< md)
  assert.ok(
    content.includes("hidden md:flex"),
    "ControlRow must hide layout controls on mobile viewports"
  );
});

test("ControlRow shows the Album profile label and the profile back destination", () => {
  const props = {
    mode: 4,
    range: "1y",
    onSelectRange: () => {},
    logStartDate: "",
    isSessionOpen: false,
    sessionTagTime: "",
    profileKind: "album",
  } as const;
  assert.match(renderToStaticMarkup(React.createElement(ControlRow, props)), />ALBUM PROFILE</);

  for (const [returnsTo, label] of [["album", "ALBUM"], ["artist", "ARTIST"], [null, "SEARCH"]] as const) {
    const markup = renderToStaticMarkup(React.createElement(ControlRow, {
      ...props,
      profileKind: returnsTo === "album" ? "track" : "album",
      returnsTo,
      onProfileBack: () => {},
    }));
    assert.match(markup, new RegExp(`<button[^>]*>← BACK TO ${label}</button>`));
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
    { target: { kind: "artist", key: "radiohead" }, range: "1y", name: "Radiohead" },
    { target: { kind: "album", key: "in-rainbows" }, range: "1y", name: "In Rainbows" },
  ];

  let jumpedIndex: number | null = null;
  let returnedToSearch = false;

  const props = {
    mode: 4 as const,
    range: "1y" as const,
    onSelectRange: () => {},
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
  assert.ok(markup.includes("← SEARCH"), "Must render ← SEARCH on desktop");
  assert.ok(markup.includes("Radiohead"), "Must render ancestor name Radiohead");
  assert.ok(markup.includes("In Rainbows"), "Must render direct parent name In Rainbows");
  assert.ok(markup.includes("max-w-[140px] truncate"), "Must truncate ancestor button text cleanly");
  assert.ok(markup.includes("text-[#A0A099] hover:text-[#EDEDE8]"), "Direct parent must be styled brighter");

  // Mobile layout
  assert.ok(markup.includes("← In Rainbows"), "Mobile view must show ← <DIRECT PARENT NAME>");
  assert.ok(markup.includes(">SEARCH</button>"), "Mobile view must show subtle SEARCH escape link");

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
  const searchBtn = buttons.find((b) => b.props?.children === "← SEARCH");
  assert.ok(searchBtn, "Must find desktop ← SEARCH button");
  searchBtn.props?.onClick?.();
  assert.equal(returnedToSearch, true, "Clicking ← SEARCH must call onReturnToSearch");

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
  const fallbackSearchBtn = findButtons(fallbackTree).find((b) => b.props?.children === "← SEARCH");
  fallbackSearchBtn?.props?.onClick?.();
  assert.equal(fallbackJumpedIndex, -1, "Clicking ← SEARCH without onReturnToSearch must call onJumpToHistory(-1)");
});

test("ControlRow renders ellipsis when profile history exceeds 2 ancestors", () => {
  const history: ProfileHistoryEntry[] = [
    { target: { kind: "artist", key: "artist-1" }, range: "1y", name: "First Artist" },
    { target: { kind: "album", key: "album-1" }, range: "1y", name: "Middle Album" },
    { target: { kind: "track", key: "track-1" }, range: "1y", name: "Parent Track" },
  ];

  const markup = renderToStaticMarkup(React.createElement(ControlRow, {
    mode: 4,
    range: "1y",
    onSelectRange: () => {},
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
