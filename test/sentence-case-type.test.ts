import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfigProvider } from "../src/context/ConfigContext";
import { ModeTabs, ADMIN_MODES } from "../src/components/listening-view/ModeTabs";
import { MetricRibbon, getRibbonLabels } from "../src/components/listening-view/MetricRibbon";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.(tsx?|css)$/.test(entry.name) ? [rel] : [];
  });
}

const uiFiles = [...sourceFiles("src/components"), ...sourceFiles("src/app"), ...sourceFiles("src/lib")];

test("layout loads Martian Mono (width axis) and Spline Sans Mono only", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /Martian_Mono/);
  assert.match(layout, /Spline_Sans_Mono/);
  assert.match(layout, /axes:\s*\[\s*"wdth"\s*\]/);
  assert.doesNotMatch(layout, /Space_Grotesk|JetBrains_Mono/);
});

test("theme maps display to Martian and sans/mono to Spline with a CJK fallback", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /--font-display:\s*var\(--font-martian-mono\)/);
  assert.match(css, /--font-sans:\s*var\(--font-spline-sans-mono\)[^;]*PingFang SC/);
  assert.match(css, /--font-mono:\s*var\(--font-spline-sans-mono\)[^;]*PingFang SC/);
});

test("no source file uses uppercase, wide tracking or bracketed labels", () => {
  const offenders: string[] = [];
  for (const file of uiFiles) {
    read(file).split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      const where = `${file}:${i + 1}`;
      if (/\buppercase\b/.test(line)) offenders.push(`${where} uppercase`);
      if (/tracking-\[0?\.\d+em\]|tracking-(wide|wider|widest)\b/.test(line)) offenders.push(`${where} wide tracking`);
      if (/\[ (?:[A-Z]|\{|\$\{)[^\]\n]* \]/.test(line)) offenders.push(`${where} bracket label`);
      if (/<span>\[<\/span>|<span>\]<\/span>/.test(line)) offenders.push(`${where} bracket icon`);
    });
  }
  assert.deepEqual(offenders, []);
});

test("mode tabs render sentence-case labels without brackets", () => {
  assert.deepEqual(
    ADMIN_MODES.map((m) => m.label),
    ["Overview", "Stream log", "Sessions", "Search", "Live player"]
  );
  assert.deepEqual(
    ADMIN_MODES.map((m) => m.abbrev),
    ["Overview", "Log", "Sessions", "Search", "Live"],
    "mobile tab labels stay readable words, not clipped abbreviations"
  );
  const markup = renderToStaticMarkup(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(ModeTabs, { activeMode: 0, onSelectMode: () => {}, isAuthenticated: true })
    )
  );
  assert.ok(markup.includes("Stream log"));
  assert.ok(!markup.replace(/<[^>]+>/g, "").includes("["), "tabs must not render brackets");
});

test("metric ribbon labels are sentence case and values use the display font", () => {
  assert.deepEqual(getRibbonLabels(4), ["Plays", "Rank", "First played", "Last played"]);
  const markup = renderToStaticMarkup(
    React.createElement(MetricRibbon, { mode: 4, metrics: ["1,234", "#12", "Jan 2024", "Today"] })
  );
  assert.match(markup, /font-display/);
});

test("nav tabs use the larger type scale", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(ModeTabs, { activeMode: 0, onSelectMode: () => {}, isAuthenticated: false })
    )
  );
  assert.match(markup, /role="tab"[^>]*class="[^"]*text-\[11px\] sm:text-\[13px\]/);
});

test("small UI text is at least 10px (glyph-only spans excepted)", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles("src/components")) {
    read(file).split("\n").forEach((line, i) => {
      if (line.includes(">▲<")) return;
      if (/text-\[(?:[0-9]|9\.5)px\]/.test(line)) offenders.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
