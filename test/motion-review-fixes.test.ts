import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./helpers/load-ts";

const root = path.resolve(__dirname, "..");
const readSrc = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const MODAL_FILES = [
  "src/components/modals/customization-modal/CustomizationModal.tsx",
  "src/components/modals/admin-login-modal/AdminLoginModal.tsx",
  "src/components/modals/upload-modal/UploadModal.tsx",
  "src/components/modals/admin-spotify-modal/AdminSpotifyModal.tsx",
] as const;

function cssBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  assert.notEqual(start, -1, `${selector} must exist in globals.css`);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`unterminated block ${selector}`);
}

// Modal open/close

test("modalPhase distinguishes entering, open, and closing", async () => {
  const { modalPhase } = await import("../src/lib/modal-motion");
  assert.equal(modalPhase(true, false), "entering");
  assert.equal(modalPhase(true, true), "open");
  assert.equal(modalPhase(false, false), "closing");
  assert.equal(modalPhase(false, true), "open", "visible until the close effect flips isVisible");
});

test("modal panel closes with its own shorter transition and no downward drift", async () => {
  const { modalPanelClass, modalBackdropClass, MODAL_EXIT_MS } = await import("../src/lib/modal-motion");
  assert.equal(MODAL_EXIT_MS, 150);

  const open = modalPanelClass("open");
  assert.match(open, /\bmodal-enter\b/);
  assert.match(open, /\bopacity-100\b/);

  const entering = modalPanelClass("entering");
  assert.match(entering, /\bopacity-0\b/);
  assert.match(entering, /motion-safe:scale-\[0\.97\]/);

  const closing = modalPanelClass("closing");
  assert.match(closing, /\bmodal-exit\b/);
  assert.match(closing, /motion-safe:scale-\[0\.97\]/, "close must visibly shrink");
  assert.doesNotMatch(closing, /translate-y/, "close must not drift down");
  assert.doesNotMatch(closing, /modal-enter/);

  assert.match(modalBackdropClass("open"), /\bmodal-enter\b/);
  assert.match(modalBackdropClass("closing"), /\bmodal-exit\b/);
  assert.match(modalBackdropClass("closing"), /pointer-events-none/);
});

test("modal transitions animate the scale and translate properties Tailwind v4 emits", () => {
  const css = readSrc("src/app/globals.css");
  const enter = cssBlock(css, "@utility modal-enter");
  const exit = cssBlock(css, "@utility modal-exit");
  for (const block of [enter, exit]) {
    assert.match(block, /\bscale\b/, "scale-* compiles to the scale property, not transform");
    assert.match(block, /\btranslate\b/);
    assert.match(block, /\bopacity\b/);
  }
  assert.match(enter, /var\(--motion-medium\)/);
  assert.match(enter, /var\(--ease-expressive\)/);
  assert.match(exit, /var\(--motion-exit\)/);
  assert.match(exit, /opacity var\(--motion-exit\) ease\b/, "exit opacity must not use the expo curve");
  assert.match(exit, /var\(--ease-out-strong\)/);
  assert.match(css, /--ease-out-strong:\s*cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(css, /--motion-exit:\s*150ms/);
});

test("all four modals use the shared modal motion and unmount after MODAL_EXIT_MS", () => {
  for (const rel of MODAL_FILES) {
    const src = readSrc(rel);
    assert.ok(src.includes("modalPanelClass("), `${rel} must use modalPanelClass`);
    assert.ok(src.includes("modalBackdropClass("), `${rel} must use modalBackdropClass`);
    assert.ok(src.includes("MODAL_EXIT_MS"), `${rel} must unmount after MODAL_EXIT_MS`);
    assert.ok(!src.includes("transition-[transform,opacity]"), `${rel} must drop the transform-only transition`);
    assert.ok(!src.includes("will-change-[transform,opacity]"), `${rel} must drop will-change on transform`);
    assert.doesNotMatch(src, /prefersReducedMotion\(\) \? 0 : 200/, `${rel} must not hard-code 200ms`);
  }
});

// View switch

test("view-enter is a plain fade with no vertical movement", () => {
  const css = readSrc("src/app/globals.css");
  const keyframes = cssBlock(css, "@keyframes view-enter");
  assert.match(keyframes, /opacity:\s*0/);
  assert.doesNotMatch(keyframes, /transform|translate/);
});

// Reduced motion

test("reduced motion keeps fades and drops movement", () => {
  const css = readSrc("src/app/globals.css");
  const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
  const block = cssBlock(css.slice(start), "@media (prefers-reduced-motion: reduce)");
  assert.match(block, /--motion-press:\s*0ms/);
  assert.match(block, /--motion-hover:\s*0ms/);
  assert.doesNotMatch(block, /--motion-fast:\s*0ms/, "opacity fades stay for reduced motion");
  assert.doesNotMatch(block, /--motion-medium:\s*0ms/);
  assert.doesNotMatch(block, /--motion-exit:\s*0ms/);
});

// Progress bars

test("CatalogEnrichmentCard bar grows with scaleX, not width", () => {
  const { CatalogEnrichmentCard } = loadTs("src/components/modals/upload-modal/CatalogEnrichmentCard.tsx");
  const html = renderToStaticMarkup(
    React.createElement(CatalogEnrichmentCard as React.FC<Record<string, unknown>>, {
      progress: { total: 200, enriched: 50, pending: 150 },
    }),
  );
  assert.match(html, /transform:scaleX\(0\.25\)/);
  assert.doesNotMatch(html, /width:\s*25%/);
  assert.doesNotMatch(html, /transition-all/);
  assert.match(html, /origin-left/);
});

test("UploadModal ingestion bar grows with scaleX, not width", () => {
  const src = readSrc("src/components/modals/upload-modal/UploadModal.tsx");
  assert.ok(!src.includes("transition-all duration-300 ease-out"), "ingestion bar must not transition width");
  assert.match(src, /scaleX\(/);
});
