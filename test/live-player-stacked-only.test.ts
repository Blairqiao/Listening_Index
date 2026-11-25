import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlRow } from "../src/components/listening-view/ControlRow";
import { presetRange } from "../src/lib/range";
import { DEFAULT_SITE_CONFIG, generateConfigTsCode, normalizeSiteConfig } from "../src/lib/config-utils";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

test("the Live Player renders only the stacked stage", () => {
  const source = read("../src/components/views/live-player-view/LivePlayerView.tsx");
  assert.ok(!source.includes("livePlayerLayout"), "LivePlayerView must not branch on a layout setting");
  assert.ok(!source.includes("Split Console"), "the split console variant must be gone");
});

test("the Live Player control row has no layout toggle", () => {
  const html = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 3,
      range: presetRange("1w"),
      onSelectRange: () => {},
      firstKey: "2026-01-01",
      todayKey: "2026-11-24",
      logStartDate: "2026-01-01",
      isSessionOpen: false,
      sessionTagTime: "",
      isAuthenticated: true,
    })
  );
  assert.ok(!/layout/i.test(html), `control row still offers a layout toggle: ${html}`);
});

test("site config no longer carries a Live Player layout", () => {
  assert.ok(!("livePlayerLayout" in DEFAULT_SITE_CONFIG));
  const normalized = normalizeSiteConfig({ livePlayerLayout: "split" } as never);
  assert.ok(!("livePlayerLayout" in normalized));
  assert.ok(!generateConfigTsCode(DEFAULT_SITE_CONFIG).includes("livePlayerLayout"));
  assert.ok(!read("../src/lib/db/queries/config.ts").includes("live_player_layout"));
});
