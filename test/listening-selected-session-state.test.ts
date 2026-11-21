import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ControlRow } from '../src/components/listening-view/ControlRow';
import { loadTs } from './helpers/load-ts';
import { readModuleSource } from './helpers/module-source';

const emptyAnalysis = {
  firstPlaysCount: 0, totalTracks: 0, topTrack: null,
  topAlbum: { title: 'None', count: 0 }, topArtist: { name: 'None', count: 0 },
};

function session(id: string, isOpen: boolean, startedAt: string, endedAt: string) {
  return { id, startedAt, endedAt, runtimeMs: 1_800_000, trackCount: 0, uniqueArtistsCount: 0, isOpen, tracks: [], analysis: emptyAnalysis };
}

// The owner is playing now (first Session open); the second Session ended earlier
const sessions = [
  session('open-now', true, '2026-11-15T10:00:00.000Z', '2026-11-15T10:30:00.000Z'),
  session('earlier', false, '2026-11-14T08:00:00.000Z', '2026-11-14T08:30:00.000Z'),
];

function sessionViewMarkup(selectedSessionId?: string) {
  const { SessionView } = loadTs('src/components/views/session-view/SessionView.tsx', {
    '@/context/ConfigContext': { useConfig: () => ({ visitorTimezone: 'UTC' }) },
    '../../Artwork': { Artwork: () => null },
    './SessionHistogram': { SessionHistogram: () => null },
    './SessionAnalysisPanel': { SessionAnalysisPanel: () => null },
  });
  return renderToStaticMarkup(React.createElement(SessionView as unknown as React.FC<Record<string, unknown>>, { sessions, selectedSessionId }));
}

function controlRowMarkup(selectedSessionId?: string) {
  const { findSelectedSession } = loadTs('src/components/listening-view/listening-helpers.ts');
  const selected = findSelectedSession(sessions, selectedSessionId);
  return renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 2,
      range: '1w',
      onSelectRange: () => {},
      logStartDate: '--',
      isSessionOpen: selected?.isOpen || false,
      sessionTagTime: '1D',
    })
  );
}

test('a selected past Session is labelled as closed while a newer Session is open', () => {
  const list = sessionViewMarkup('earlier');
  assert.ok(list.includes('Last session'));
  assert.ok(!list.includes('Current session'));

  const row = controlRowMarkup('earlier');
  assert.ok(row.includes('Closed 1D ago'));
  assert.ok(!row.includes('Active'));
});

test('the open Session keeps its active labels when selected or by default', () => {
  for (const selected of ['open-now', undefined]) {
    assert.ok(sessionViewMarkup(selected).includes('Current session'));
    assert.ok(controlRowMarkup(selected).includes('Active'));
  }
});

test('ListeningView gives ControlRow the selected Session state and the footer the live state', () => {
  const source = readModuleSource(path.resolve(__dirname, '../src/components/ListeningView.tsx'));
  assert.ok(source.includes('isSessionOpen={activeSession?.isOpen || false}'));
  assert.ok(source.includes('isLive={isSystemLive}'));
});
