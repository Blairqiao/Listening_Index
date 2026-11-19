import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActivityChart } from "../src/components/views/ActivityChart";
import { HourChart } from "../src/components/views/search-view/HourChart";
import { ProportionShareBar, SegmentedShareBar } from "../src/components/views/search-view/ShareBar";
import { buildShareSegments, hourHistogram, OTHER_SEGMENT_ID } from "../src/lib/profile-stats";

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

test("ProportionShareBar presents the share and omits an empty bar", () => {
  const props = { heading: "[ SHARE OF ARTIST ]", part: 14, total: 50 };
  const markup = renderToStaticMarkup(React.createElement(ProportionShareBar, props));
  assert.match(markup, /28% · 14 PLAYS/);
  assert.match(markup, /OF 50/);
  assert.equal(renderToStaticMarkup(React.createElement(ProportionShareBar, { ...props, part: 0 })), "");
});

const props = {
  heading: "[ SHARE OF PLAYS ]",
  segments: buildShareSegments([{ id: "track", name: "Track name", plays: 14 }], 50),
  total: 50,
  onActiveChange: () => {},
};

test("SegmentedShareBar reports the whole, Track or Other share", () => {
  const render = (activeId: string | null) =>
    renderToStaticMarkup(React.createElement(SegmentedShareBar, { ...props, activeId }));
  assert.match(render(null), /50 PLAYS/);
  const track = render("track");
  assert.match(track, /TRACK NAME · 28%/);
  assert.match(track, /14 OF 50/);
  assert.equal(track.match(/class="bg-music-accent"/g)?.length, 1);
  assert.match(track, /Track name: 28%/);
  assert.match(render(OTHER_SEGMENT_ID), /OTHER TRACKS · 72%/);
});

test("SegmentedShareBar reports hover on the Other segment", () => {
  const changes: (string | null)[] = [];
  const tree = SegmentedShareBar({ ...props, activeId: null, onActiveChange: (id) => changes.push(id) });
  type ElementProps = {
    children?: React.ReactNode;
    title?: string;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  };
  function findOther(node: React.ReactNode): ElementProps | undefined {
    if (!React.isValidElement<ElementProps>(node)) return;
    if (node.props.title === "Other Tracks") return node.props;
    return React.Children.toArray(node.props.children).map(findOther).find(Boolean);
  }
  const other = findOther(tree);
  assert.ok(other?.onMouseEnter && other.onMouseLeave);
  other.onMouseEnter();
  other.onMouseLeave();
  assert.deepEqual(changes, [OTHER_SEGMENT_ID, null]);
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
