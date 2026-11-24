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

test("layout loads IBM Plex Mono and Spline Sans Mono only", () => {
  const layout = read("src/app/layout.tsx");
  assert.match(layout, /IBM_Plex_Mono/);
  assert.match(layout, /weight:\s*\[[^\]]*"500"/);
  assert.match(layout, /Spline_Sans_Mono/);
  assert.doesNotMatch(layout, /Martian_Mono|Space_Grotesk|JetBrains_Mono/);
});

test("display text does not use font-stretch (IBM Plex Mono has no width axis)", () => {
  const offenders = uiFiles.filter((file) => /font-stretch/.test(read(file)));
  assert.deepEqual(offenders, []);
});

test("theme maps display to IBM Plex Mono and sans/mono to Spline with a CJK fallback", () => {
  const css = read("src/app/globals.css");
  assert.match(css, /--font-display:\s*var\(--font-ibm-plex-mono\)[^;]*PingFang SC/);
  assert.doesNotMatch(css, /martian/i);
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
    ["Overview", "Stream log", "Sessions", "Calendar", "Search", "Live player"]
  );
  assert.deepEqual(
    ADMIN_MODES.map((m) => m.abbrev),
    ["Overview", "Log", "Sessions", "Cal", "Search", "Live"],
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

const ICON_TAG = /<(ArrowUpRight|Check|ChevronDown|Copy|ExternalLink|Eye|EyeOff|FileArchive|Loader2|Lock|Menu|Music2|Unlock|Upload|X)\b/;

test("nav icons scale with the nav text (14px mobile, 16px desktop)", () => {
  const markup = renderToStaticMarkup(
    React.createElement(
      ConfigProvider,
      null,
      React.createElement(ModeTabs, { activeMode: 0, onSelectMode: () => {}, isAuthenticated: false })
    )
  );
  const icons = markup.match(/<svg[^>]*lucide-(menu|lock)[^>]*>/g) ?? [];
  assert.equal(icons.length, 2);
  for (const icon of icons) assert.match(icon, /w-3\.5 h-3\.5 sm:w-4 sm:h-4/);
});

test("no UI icon renders below 14px", () => {
  const offenders: string[] = [];
  for (const file of sourceFiles("src/components")) {
    const lines = read(file).split("\n");
    lines.forEach((line, i) => {
      const iconContext = ICON_TAG.test(line) || ICON_TAG.test(lines[i - 1] ?? "");
      if (!iconContext) return;
      if (/\bw-3 h-3\b|size=\{(?:[0-9]|1[0-3])\}/.test(line)) offenders.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
