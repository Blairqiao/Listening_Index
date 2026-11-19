import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTs } from './helpers/load-ts';
import { readModuleSource } from './helpers/module-source';

const analysis = {
  firstPlaysCount: 0, totalTracks: 0, topTrack: null,
  topAlbum: { title: 'None', count: 0 }, topArtist: { name: 'None', count: 0 },
};
const tracks = Array.from({ length: 12 }, (_, i) => ({
  id: `play-${i}`, trackId: `track-${i}`, title: `Track ${i}`, artist: 'Artist', album: 'Album',
  playedAt: new Date(Date.UTC(2026, 10, 15, 10, i)).toISOString(), durationMs: 180000,
}));
const sessions = [{
  id: 's1', startedAt: '2026-11-15T10:00:00.000Z', endedAt: '2026-11-15T10:30:00.000Z',
  runtimeMs: 1_800_000, trackCount: tracks.length, uniqueArtistsCount: 1, isOpen: false, tracks, analysis,
}];

function sessionViewMarkup() {
  const { SessionView } = loadTs('src/components/views/session-view/SessionView.tsx', {
    '@/context/ConfigContext': { useConfig: () => ({ visitorTimezone: 'UTC' }) },
    '../../Artwork': { Artwork: () => null },
    './SessionHistogram': { SessionHistogram: () => null },
    './SessionAnalysisPanel': { SessionAnalysisPanel: () => null },
  });
  return renderToStaticMarkup(React.createElement(SessionView as unknown as React.FC<Record<string, unknown>>, { sessions }));
}

// The first client render must equal the server render, or React reports a hydration error.
test('SessionView first render does not depend on the viewport width', () => {
  const server = sessionViewMarkup();
  const g = globalThis as { window?: unknown };
  g.window = { innerWidth: 390 };
  try {
    assert.equal(sessionViewMarkup(), server);
  } finally {
    delete g.window;
  }
});

test('viewport width is read in effects, never in a state initialiser', () => {
  for (const file of [
    'src/components/ListeningView.tsx',
    'src/components/views/StreamLogView.tsx',
    'src/components/views/session-view/SessionView.tsx',
  ]) {
    const source = readModuleSource(file);
    assert.doesNotMatch(source, /useState[^;]*?\(\s*\(\)\s*=>\s*\{[^}]*innerWidth/, file);
  }
});
