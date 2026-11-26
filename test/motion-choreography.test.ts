import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const readSrc = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

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

// Press feedback

test("motion-hover animates the scale property so active:scale-* presses ease instead of snapping", () => {
  const block = cssBlock(readSrc("src/app/globals.css"), "@utility motion-hover");
  assert.match(block, /\bscale var\(--motion-press\)/);
  assert.match(readSrc("src/components/views/TastePhaseCards.tsx"), /motion-hover[^"`]*active:scale-\[0\.99\]/);
});

// Mini player entrance and exit

test("mini player bar slides up on enter and back down on exit, fading instead under reduced motion", async () => {
  const { miniPlayerBarClass, MINI_PLAYER_EXIT_MS } = await import("../src/components/listening-view/mini-player");
  assert.equal(MINI_PLAYER_EXIT_MS, 180);
  const entering = miniPlayerBarClass("entering");
  assert.match(entering, /motion-safe:translate-y-full/);
  assert.match(entering, /motion-reduce:opacity-0/);
  assert.doesNotMatch(entering, /drawer-(enter|exit)/, "the start state must not transition");
  const open = miniPlayerBarClass("open");
  assert.match(open, /\bdrawer-enter\b/);
  assert.doesNotMatch(open, /translate-y-full|opacity-0/);
  const closing = miniPlayerBarClass("closing");
  assert.match(closing, /\bdrawer-exit\b/);
  assert.match(closing, /motion-safe:translate-y-full/);
});

test("drawer transitions use the drawer curve to enter and a shorter ease-out to exit", () => {
  const css = readSrc("src/app/globals.css");
  assert.match(css, /--ease-drawer:\s*cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
  const enter = cssBlock(css, "@utility drawer-enter");
  assert.match(enter, /translate 240ms var\(--ease-drawer\)/);
  assert.match(enter, /opacity 240ms/);
  const exit = cssBlock(css, "@utility drawer-exit");
  assert.match(exit, /translate 180ms var\(--ease-out-strong\)/);
  assert.match(exit, /opacity 180ms/);
});

test("ListeningView keeps the mini player mounted through its exit", () => {
  const src = readSrc("src/components/ListeningView.tsx");
  assert.match(src, /usePresence\(\s*isMiniPlayerOpen,\s*MINI_PLAYER_EXIT_MS,\s*miniPlayerEnterDelay\s*\)/);
  assert.match(src, /miniPlayer\.shouldRender && miniPlayerTrack/);
  assert.match(src, /miniPlayerBarClass\(miniPlayer\.phase\)/);
  assert.match(readSrc("src/components/listening-view/MiniPlayerBar.tsx"), /className\?: string/);
});

test("on first load the mini player slide-up ends when the entrance settles", async () => {
  const c = await import("../src/lib/choreography");
  assert.equal(c.INTRO_SETTLE_MS, 940, "the last bar finishes at 440ms + 500ms");
  assert.equal(c.MINI_PLAYER_ENTER_MS, 240, "matches drawer-enter");
  assert.ok(c.INTRO_MS >= c.INTRO_SETTLE_MS);
  assert.equal(c.miniPlayerIntroDelay(0), 700);
  assert.equal(c.miniPlayerIntroDelay(500), 200);
  assert.equal(c.miniPlayerIntroDelay(900), 0, "a late player state slides up right away");

  const src = readSrc("src/components/ListeningView.tsx");
  assert.match(src, /introPhase !== "pending"/, "the bar waits for the entrance to start");
  assert.match(src, /introStartRef\.current = performance\.now\(\)/);

  const presence = readSrc("src/lib/usePresence.ts");
  assert.match(presence, /getEnterDelay\?: \(\) => number/);
  assert.match(presence, /setTimeout\(reveal, delay\)/);
});

test("the mini player progress line keeps its 2px accent look but no longer animates its width", async () => {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { MiniPlayerBar } = await import("../src/components/listening-view/MiniPlayerBar");
  const html = renderToStaticMarkup(
    React.createElement(MiniPlayerBar, {
      track: { name: "A", artist: "B", imageUrl: null, id: "t" },
      isPlaying: true,
      progress: 0.5,
      controlsDisabled: false,
      onTogglePlay: () => {},
      onPrevious: () => {},
      onNext: () => {},
      onOpenPlayer: () => {},
    }),
  );
  const line = html.match(/<div[^>]*aria-hidden="true"[^>]*>/)?.[0] ?? "";
  assert.match(line, /h-\[2px\]/);
  assert.match(line, /\bbg-music-accent\b/);
  assert.match(line, /width:50%/);
  assert.doesNotMatch(line, /transition|duration-/, "it swept in from the left when the bar appeared");
});

// Metric value swap (removed: numbers change with no animation)

test("MetricRibbon swaps changed numbers instantly", () => {
  const src = readSrc("src/components/listening-view/MetricRibbon.tsx");
  assert.doesNotMatch(src, /\.animate\(|METRIC_SWAP|changedIndexes/);
  assert.doesNotMatch(readSrc("src/lib/choreography.ts"), /METRIC_SWAP|changedIndexes/);
});

// Activity bars

const cadence = [
  { date: "2026-11-01", count: 10, startTime: "2026-11-01T00:00:00.000Z", endTime: "2026-11-01T23:59:59.999Z" },
  { date: "2026-11-02", count: 5, startTime: "2026-11-02T00:00:00.000Z", endTime: "2026-11-02T23:59:59.999Z" },
  { date: "2026-11-03", count: 0, startTime: "2026-11-03T00:00:00.000Z", endTime: "2026-11-03T23:59:59.999Z" },
];

test("activity bars size with scaleY from the baseline so a range step can morph them", async () => {
  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ActivityChart } = await import("../src/components/views/ActivityChart");
  for (const onSelectBucket of [() => {}, undefined]) {
    const html = renderToStaticMarkup(
      React.createElement(ActivityChart, { granularity: "day", activityCadence: cadence, onSelectBucket, visitorTimezone: "UTC" }),
    );
    assert.match(html, /transform:scaleY\(1\)/);
    assert.match(html, /transform:scaleY\(0\.5\)/);
    assert.match(html, /transform:scaleY\(0\.04\)/, "empty buckets keep the 4% stub");
    assert.doesNotMatch(html, /height:\d+%/);
    assert.match(html, /\bbar-morph\b/);
    assert.match(html, /\borigin-bottom\b/);
  }
});

test("bar-morph eases bar heights over 280ms with an ease-in-out and keeps the fast hover color", () => {
  const css = readSrc("src/app/globals.css");
  assert.match(css, /--ease-in-out:\s*cubic-bezier\(0\.65, 0, 0\.35, 1\)/);
  const block = cssBlock(css, "@utility bar-morph");
  assert.match(block, /transform 280ms var\(--ease-in-out\)/, "a strong ease-out spent the change in ~50ms and read as rushed");
  assert.match(block, /background-color var\(--motion-hover\)/);
});

test("when the bar count changes (this week has fewer bars), the new bars grow from the baseline", () => {
  const css = readSrc("src/app/globals.css");
  assert.match(cssBlock(css, "@keyframes bar-regrow"), /scale:\s*1 0/);
  assert.match(cssBlock(css, "@utility bar-regrow"), /animation: bar-regrow 280ms var\(--ease-out-strong\) both/);
  const reduced = css.slice(css.indexOf("/* Reduced motion: bars swap"));
  assert.match(reduced.slice(0, 300), /\.bar-regrow[\s\S]*animation: none/);

  const src = readSrc("src/components/views/ActivityChart.tsx");
  assert.match(src, /barCount !== prevBarCount/);
  assert.match(src, /prevBarCount > 0/, "no regrow on the first load: the skeleton has no real bars");
  assert.match(src, /regrow \? "bar-regrow" : ""/);
});

test("the bar container remounts when the bar count changes, so only same-count steps morph", () => {
  const src = readSrc("src/components/views/ActivityChart.tsx");
  assert.match(src, /key=\{barCount\}[\s\S]{0,80}ref=\{chartRef\}/);
});

// Calendar range sweep (removed: it didn't read well)

test("CalendarView picks highlight their range at once, with no sweep", () => {
  const src = readSrc("src/components/views/CalendarView.tsx");
  assert.doesNotMatch(src, /pendingSweepRef|RANGE_SWEEP|staggerDelays/);
  assert.doesNotMatch(readSrc("src/lib/choreography.ts"), /RANGE_SWEEP|staggerDelays/);
});

// First-load entrance

test("intro delays: metrics lead, track rows follow with shrinking gaps, bars grow left to right", async () => {
  const c = await import("../src/lib/choreography");
  assert.deepEqual([0, 1, 2, 3].map(c.metricIntroDelay), [0, 70, 120, 160]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 9].map(c.trackRowIntroDelay), [200, 250, 290, 320, 345, 365, 365, 365]);
  assert.equal(c.INDEX_INTRO_DELAY_MS, 260);
  assert.equal(c.barIntroDelay(0, 28), 240);
  assert.equal(c.barIntroDelay(27, 28), 440);
  assert.ok(c.INTRO_MS >= 440 + 500, "the intro gate outlasts the last bar");
  assert.ok(c.INTRO_MS <= 1200);
});

test("intro CSS holds elements while pending, plays under data-intro=playing, and fades plainly for reduced motion", () => {
  const css = readSrc("src/app/globals.css");
  assert.match(cssBlock(css, "@keyframes intro-rise"), /opacity:\s*0[\s\S]*translate:\s*0 var\(--intro-rise/);
  assert.match(cssBlock(css, "@keyframes intro-grow"), /scale:\s*1 0/);
  assert.match(cssBlock(css, "@keyframes intro-fade"), /opacity:\s*0/);
  const durations: Record<string, string> = { "intro-rise": "450ms", "intro-row": "420ms", "intro-fade": "450ms", "intro-grow": "500ms" };
  for (const [cls, ms] of Object.entries(durations)) {
    const block = cssBlock(css, `[data-intro="playing"] .${cls} {`);
    assert.match(block, new RegExp(`\\s${ms}\\s`), `${cls} runs ${ms}`);
    assert.match(block, /var\(--intro-delay, 0ms\)/, `${cls} must read --intro-delay`);
    assert.match(block, /\bboth\b/, `${cls} must hold its start state while delayed`);
  }
  // Server HTML arrives pending: elements wait hidden for hydration, and show
  // on their own after 2.5s if the script never runs.
  const pending = css.slice(css.indexOf('[data-intro="pending"] .intro-rise'));
  assert.match(pending.slice(0, 400), /animation: intro-fade 300ms ease 2\.5s both/);
  const reduced = css.slice(css.indexOf("/* Reduced motion: the intro"));
  assert.match(reduced.slice(0, 600), /animation-name:\s*intro-fade/);
  assert.match(reduced.slice(0, 600), /animation-delay:\s*0ms/);
});

test("ListeningView starts the intro after hydration and fonts, then clears it, and lifts the veil in 200ms", () => {
  const src = readSrc("src/components/ListeningView.tsx");
  assert.match(src, /useState<IntroPhase>\("pending"\)/);
  assert.match(src, /data-intro=\{introPhase === "done" \? undefined : introPhase\}/);
  assert.match(src, /withRevealCap\(document\.fonts\.ready/);
  assert.match(src, /setIntroPhase\("playing"\)/);
  assert.match(src, /setTimeout\(\(\) => setIntroPhase\("done"\), introDurationMs\(introSettle\)\)/);
  assert.match(src, /fixed inset-0 z-40[^`]*duration-\[var\(--motion-medium\)\]/);
  assert.doesNotMatch(readSrc("src/app/globals.css"), /--motion-showpiece/);
});

test("intro roles: metric contents rise, track rows rise, indexes fade, bars grow", async () => {
  assert.match(readSrc("src/components/listening-view/MetricRibbon.tsx"), /intro-rise[\s\S]{0,200}metricIntroDelay\(i\)/);
  const overview = readSrc("src/components/views/OverviewView.tsx");
  assert.match(overview, /intro-row[\s\S]{0,300}trackRowIntroDelay\(idx\)/);
  assert.equal((overview.match(/intro-fade/g) ?? []).length, 2, "artist and album indexes fade");
  assert.match(overview, /INDEX_INTRO_DELAY_MS/);

  const React = (await import("react")).default;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { ActivityChart } = await import("../src/components/views/ActivityChart");
  const html = renderToStaticMarkup(
    React.createElement(ActivityChart, { granularity: "day", activityCadence: cadence, visitorTimezone: "UTC" }),
  );
  assert.match(html, /\bintro-grow\b/);
  assert.match(html, /--intro-delay:240ms/);
});

test("each tab has its own entrance: the view body rises after the ribbon, first on Search", async () => {
  const c = await import("../src/lib/choreography");
  assert.equal(c.viewIntroDelay(0), null, "Overview keeps its own stagger");
  for (const mode of [1, 2, 3, 5] as const) assert.equal(c.viewIntroDelay(mode), 200, `mode ${mode} follows the ribbon`);
  assert.equal(c.viewIntroDelay(4), 0, "Search and profiles have no ribbon to follow");

  assert.equal(c.introSettleMs(0), c.INTRO_SETTLE_MS);
  assert.equal(c.introSettleMs(5), 650);
  assert.equal(c.introSettleMs(4), 450);
  assert.equal(c.introSettleMs(4, true), c.INTRO_SETTLE_MS, "profile bars grow like Overview's");
  assert.ok(c.introDurationMs(650) > 650, "the gate outlasts the settle");
  assert.equal(c.introDurationMs(c.INTRO_SETTLE_MS), c.INTRO_MS);

  assert.equal(c.miniPlayerIntroDelay(0, c.introSettleMs(5)), 410, "the bar lands as Calendar settles");
  assert.equal(c.miniPlayerIntroDelay(0, c.introSettleMs(4)), 210);
});

test("the entrance waits for the open tab's own data, so Calendar and profiles don't rise as skeletons", async () => {
  const c = await import("../src/lib/choreography");
  const idle = { isCalendarLoading: true, hasProfileTarget: false, isProfileLoading: true };
  assert.equal(c.isIntroViewReady(0, idle), true);
  assert.equal(c.isIntroViewReady(4, idle), true, "the Search page has nothing to wait for");
  assert.equal(c.isIntroViewReady(5, idle), false);
  assert.equal(c.isIntroViewReady(5, { ...idle, isCalendarLoading: false }), true);
  assert.equal(c.isIntroViewReady(4, { ...idle, hasProfileTarget: true }), false);
  assert.equal(c.isIntroViewReady(4, { ...idle, hasProfileTarget: true, isProfileLoading: false }), true);
  assert.ok(c.VIEW_INTRO_WAIT_MS <= 1500, "a slow tab must not hold the page long");

  const src = readSrc("src/components/ListeningView.tsx");
  assert.match(src, /isIntroViewReady\(activeMode/);
  assert.match(src, /setTimeout\(\(\) => setIsViewWaitOver\(true\), VIEW_INTRO_WAIT_MS\)/);
});

test("ListeningView gives the non-Overview view body one rise, only on the tab the entrance started on", () => {
  const src = readSrc("src/components/ListeningView.tsx");
  assert.match(src, /setIntroMode\(activeMode\)/);
  assert.match(src, /viewIntroDelay\(activeMode\)/);
  assert.match(src, /activeMode === introMode && bodyIntroDelay !== null \? "intro-rise" : ""/);
  assert.match(src, /miniPlayerIntroDelay\(performance\.now\(\) - introStartRef\.current, introSettle\)/);
  assert.match(src, /setIntroSettle\(introSettleMs\(activeMode, Boolean\(profileTarget\)\)\)/);
});
