import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConfigProvider } from '../src/context/ConfigContext';
import { StreamLogView } from '../src/components/views/StreamLogView';
import type { StreamLogItem } from '../src/lib/types';

function render(timezone: string) {
  const entries = Array.from({ length: 75 }, (_, index) => ({
    id: String(index), trackId: 'track', playedAt: '2026-10-01T00:30:00.000Z', durationMs: 180_000,
    title: `Track ${index}`, artist: 'Artist', album: 'Album',
  })) as StreamLogItem[];
  return renderToStaticMarkup(React.createElement(ConfigProvider, { initialVisitorTimezone: timezone, children: React.createElement(StreamLogView, { entries }) }));
}

test('all retained Stream Log rows format raw timestamps and local day headers in the visitor timezone', () => {
  const utc = render('UTC');
  const chicago = render('America/Chicago');
  assert.equal((utc.match(/00:30/g) || []).length, 75);
  assert.equal((chicago.match(/19:30/g) || []).length, 75);
  assert.match(utc, /01 OCT/);
  assert.match(chicago, /30 SEP/);
  assert.doesNotMatch(chicago, /01 OCT/);
});
