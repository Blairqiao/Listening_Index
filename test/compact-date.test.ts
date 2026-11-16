import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compactDate } from '../src/lib/format-utils';
import { ControlRow } from '../src/components/listening-view/ControlRow';

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
      range: '1w',
      onSelectRange: () => {},
      logStartDate: '--',
      isSessionOpen: false,
      sessionTagTime: '--',
    })
  );
  assert.ok(markup.includes('SINCE --'));
  assert.ok(!markup.includes('Invalid Date') && !markup.includes('NaN'));
});
