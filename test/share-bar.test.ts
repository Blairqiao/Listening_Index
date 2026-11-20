import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityChart } from "../src/components/views/ActivityChart";
import { HourChart } from "../src/components/views/search-view/HourChart";
import { DayOfWeekChart } from "../src/components/views/search-view/DayOfWeekChart";
import { ProfileChart } from "../src/components/views/search-view/ProfileChart";
import { ProportionShareBar, SegmentedShareBar } from "../src/components/views/search-view/ShareBar";
import { buildShareSegments, dayOfWeekHistogram, hourHistogram, OTHER_SEGMENT_ID } from "../src/lib/profile-stats";

test("HourChart draws 24 hour bars under the range heading", () => {
  const aside = React.createElement("span", null, "ASIDE");
  const markup = renderToStaticMarkup(React.createElement(HourChart, { counts: hourHistogram([2, 22, 22]), headerAside: aside }));
  assert.match(markup, /\[ WHEN IT PLAYS \]/);
  assert.match(markup, /ASIDE/);
  assert.match(markup, /aria-label="Plays by hour of day, peak 22:00"/);
  assert.match(markup, /title="22:00 · 2 plays"/);
  assert.equal(markup.match(/title="\d\d:00 · /g)?.length, 24);
  assert.match(markup, /h-\[80px\]/);
  assert.match(markup, />00<.*>06<.*>12<.*>18<.*>23</);

  const empty = renderToStaticMarkup(React.createElement(HourChart, { counts: hourHistogram([]) }));
  assert.match(empty, /aria-label="No plays by hour"/);
});

test("DayOfWeekChart renders 7 labeled bars in the 80px frame with peak aria-label", () => {
  // Friday is day 5 (index 4 in 0..6)
  const counts = dayOfWeekHistogram([5, 5, 5, 1]);
  const aside = React.createElement("span", null, "ASIDE");
  const markup = renderToStaticMarkup(React.createElement(DayOfWeekChart, { counts, headerAside: aside }));
  assert.match(markup, /\[ WHEN IT PLAYS \]/);
  assert.match(markup, /ASIDE/);
  assert.match(markup, /aria-label="Plays by day of week, peak FRI"/);
  assert.match(markup, /title="FRI · 3 plays"/);
  assert.match(markup, /h-\[80px\] w-full flex gap-\[4px\] items-end/);
  assert.match(markup, /grid grid-cols-7 text-center/);
  assert.match(markup, />MON<.*>TUE<.*>WED<.*>THU<.*>FRI<.*>SAT<.*>SUN</);

  const empty = renderToStaticMarkup(React.createElement(DayOfWeekChart, { counts: [0, 0, 0, 0, 0, 0, 0] }));
  assert.match(empty, /aria-label="No plays by day of week"/);
});

test("DayOfWeekChart supports a custom heading", () => {
  const customHeading = React.createElement("button", null, "[ BY DAY ]");
  const markup = renderToStaticMarkup(React.createElement(DayOfWeekChart, { counts: [1, 0, 0, 0, 0, 0, 0], heading: customHeading }));
  assert.match(markup, /<button>\[ BY DAY \]/);
  assert.doesNotMatch(markup, /\[ WHEN IT PLAYS \]/);
});

test("ProfileChart renders [ OVER TIME ] by default and reserves readout height", () => {
  const baseProps = {
    range: "1d" as const,
    activityCadence: [],
    isLoading: false,
    visitorTimezone: "UTC",
    hourOfDay: hourHistogram([14, 14]),
    dayOfWeek: [0, 0, 0, 0, 10, 0, 0],
    streakDays: 5,
  };
  const markup = renderToStaticMarkup(React.createElement(ProfileChart, baseProps));
  assert.match(markup, /\[ OVER TIME \]/);
  assert.match(markup, /LONGEST STREAK · 5 DAYS/);
  assert.match(markup, /mt-1 h-4/);
});

test("ProportionShareBar formats numbers with toLocaleString and omits empty bar", () => {
  const props = { heading: "[ SHARE OF ARTIST ]", part: 1400, total: 5000 };
  const markup = renderToStaticMarkup(React.createElement(ProportionShareBar, props));
  assert.match(markup, /28% · 1,400 PLAYS/);
  assert.match(markup, /OF 5,000/);
  assert.equal(renderToStaticMarkup(React.createElement(ProportionShareBar, { ...props, part: 0 })), "");
});

const props = {
  heading: "[ SHARE OF PLAYS ]",
  segments: buildShareSegments([{ id: "track", name: "Track name", plays: 1400 }], 5000),
  total: 5000,
  onActiveChange: () => {},
};

test("SegmentedShareBar formats numbers with toLocaleString and reports shares", () => {
  const render = (activeId: string | null) =>
    renderToStaticMarkup(React.createElement(SegmentedShareBar, { ...props, activeId }));
  assert.match(render(null), /5,000 PLAYS/);
  const track = render("track");
  assert.match(track, /TRACK NAME · 28%/);
  assert.match(track, /1,400 OF 5,000/);
  assert.match(track, /cursor-pointer/);
  assert.equal(track.match(/class="bg-music-accent cursor-pointer"/g)?.length, 1);
  assert.match(track, /Track name: 28%/);
  assert.match(render(OTHER_SEGMENT_ID), /OTHER TRACKS · 72%/);
});

test("SegmentedShareBar reports hover on the Other segment with mouse pointer", () => {
  const changes: (string | null)[] = [];
  const tree = SegmentedShareBar({ ...props, activeId: null, onActiveChange: (id) => changes.push(id) });
  type ElementProps = {
    children?: React.ReactNode;
    title?: string;
    onPointerEnter?: (e: { pointerType: string }) => void;
    onPointerLeave?: (e: { pointerType: string }) => void;
    onClick?: () => void;
  };
  function findOther(node: React.ReactNode): ElementProps | undefined {
    if (!React.isValidElement<ElementProps>(node)) return;
    if (node.props.title === "Other Tracks") return node.props;
    return React.Children.toArray(node.props.children).map(findOther).find(Boolean);
  }
  const other = findOther(tree);
  assert.ok(other?.onPointerEnter && other.onPointerLeave && other.onClick);

  // Touch pointer entry should not trigger hover active change
  other.onPointerEnter({ pointerType: "touch" });
  assert.deepEqual(changes, []);

  // Mouse pointer entry and leave should trigger hover active change
  other.onPointerEnter({ pointerType: "mouse" });
  other.onPointerLeave({ pointerType: "mouse" });
  assert.deepEqual(changes, [OTHER_SEGMENT_ID, null]);
});

test("SegmentedShareBar supports click toggle on segments", () => {
  const changes: (string | null)[] = [];
  // When activeId is null, clicking 'track' segment sets it to 'track'
  const inactiveTree = SegmentedShareBar({ ...props, activeId: null, onActiveChange: (id) => changes.push(id) });
  type ElementProps = {
    children?: React.ReactNode;
    title?: string;
    onClick?: () => void;
  };
  function findTrack(node: React.ReactNode): ElementProps | undefined {
    if (!React.isValidElement<ElementProps>(node)) return;
    if (node.props.title === "Track name") return node.props;
    return React.Children.toArray(node.props.children).map(findTrack).find(Boolean);
  }
  const trackInactive = findTrack(inactiveTree);
  assert.ok(trackInactive?.onClick);
  trackInactive.onClick();

  // When activeId is 'track', clicking 'track' segment toggles it back to null
  const activeTree = SegmentedShareBar({ ...props, activeId: "track", onActiveChange: (id) => changes.push(id) });
  const trackActive = findTrack(activeTree);
  assert.ok(trackActive?.onClick);
  trackActive.onClick();

  assert.deepEqual(changes, ["track", null]);
});

test("ActivityChart retains the default heading and supports an aside", () => {
  const activity = { range: "1d", activityCadence: [] } as const;
  const props = { ...activity, activityCadence: [] };
  const markup = renderToStaticMarkup(React.createElement(ActivityChart, props));
  assert.match(markup, /<div class="font-mono text-\[11px\] tracking-\[0.14em\] text-\[#5A5A55\] mb-2 select-none">\[ ACTIVITY \/ 1D \]<\/div>/);
  const aside = renderToStaticMarkup(React.createElement(ActivityChart, { ...props, headerAside: "LONGEST STREAK" }));
  assert.match(aside, /LONGEST STREAK/);
  const bare = renderToStaticMarkup(React.createElement(ActivityChart, { ...props, label: "PLAYS", showRange: false }));
  assert.match(bare, />\[ PLAYS \]</);
  const customHeading = renderToStaticMarkup(React.createElement(ActivityChart, { ...props, heading: React.createElement("button", null, "[ OVER TIME ]") }));
  assert.match(customHeading, /<button>\[ OVER TIME \]/);
  assert.doesNotMatch(customHeading, /\[ ACTIVITY/);
});

test("HourChart supports a custom heading", () => {
  const customHeading = renderToStaticMarkup(React.createElement(HourChart, { counts: hourHistogram([2]), heading: React.createElement("button", null, "[ BY HOUR ]") }));
  assert.match(customHeading, /<button>\[ BY HOUR \]/);
  assert.doesNotMatch(customHeading, /WHEN IT PLAYS/);
});
