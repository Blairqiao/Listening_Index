import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compactDate } from '../src/lib/format-utils';
import { ControlRow } from '../src/components/listening-view/ControlRow';
import { logStartDateKey, presetRange } from '../src/lib/range';

test('compactDate returns the placeholder for an unparseable date', () => {
  assert.equal(compactDate('--'), '--');
  assert.equal(compactDate(''), '--');
});

test('compactDate formats the month as a plain number in every locale', () => {
  const original = Date.prototype.toLocaleString;
  // What a CJK browser locale returns for { month: "numeric" }
  Date.prototype.toLocaleString = () => '3月';
  try {
    assert.equal(compactDate('05 MAR 2026'), '3/5/2026');
  } finally {
    Date.prototype.toLocaleString = original;
  }
});

test('ControlRow shows the placeholder scope label while the Overview has no start date', () => {
  const markup = renderToStaticMarkup(
    React.createElement(ControlRow, {
      mode: 0,
      range: presetRange('1w'),
      onSelectRange: () => {},
      firstKey: '2026-11-24',
      todayKey: '2026-11-24',
      logStartDate: '--',
      isSessionOpen: false,
      sessionTagTime: '--',
    })
  );
  assert.ok(markup.includes('Since --'));
  assert.ok(!markup.includes('Invalid Date') && !markup.includes('NaN'));
});

test('logStartDateKey parses DD MMM YYYY and ISO date-only without timezone day shift', () => {
  assert.equal(logStartDateKey('14 AUG 2024', '2026-11-24'), '2024-08-14');
  assert.equal(logStartDateKey('2024-08-14', '2026-11-24'), '2024-08-14');
  assert.equal(logStartDateKey('--', '2026-11-24'), '2026-11-24');
  assert.equal(logStartDateKey('', '2026-11-24'), '2026-11-24');
  assert.equal(logStartDateKey('2024-02-30', '2026-11-24'), '2026-11-24');
  assert.equal(logStartDateKey('2024-13-01', '2026-11-24'), '2026-11-24');
  assert.equal(logStartDateKey('31 FEB 2024', '2026-11-24'), '2026-11-24');
  assert.equal(logStartDateKey('14 XYZ 2024', '2026-11-24'), '2026-11-24');
  assert.equal(logStartDateKey('not-a-date', '2026-11-24'), '2026-11-24');
});
