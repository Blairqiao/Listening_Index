import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHistoryFile,
  resolveImportOutcome,
  stepOnOpen,
} from '../src/components/modals/upload-modal/upload-outcome';
import { parseHistoryRecords } from '../src/lib/history-parser';

const extendedRow = {
  ts: '2026-03-05T10:00:00Z',
  ms_played: 200_000,
  master_metadata_track_name: 'Track',
  master_metadata_album_artist_name: 'Artist',
  master_metadata_album_album_name: 'Album',
  spotify_track_uri: 'spotify:track:4iV5W9uYEdYUVa79Axb7Rh',
};
const basicRow = { endTime: '2026-03-05 10:00', artistName: 'Artist', trackName: 'Track', msPlayed: 200_000 };

test('classifyHistoryFile: an Extended streaming history file yields its rows', () => {
  const file = classifyHistoryFile(JSON.stringify([extendedRow]));
  assert.equal(file.kind, 'history');
  assert.equal(parseHistoryRecords(file.kind === 'history' ? file.rows : []).length, 1);
});

test('classifyHistoryFile: the basic account data export is recognised', () => {
  assert.equal(classifyHistoryFile(JSON.stringify([basicRow, basicRow])).kind, 'basic-export');
});

test('classifyHistoryFile: invalid JSON and non-array JSON are unreadable', () => {
  assert.equal(classifyHistoryFile('{ not json').kind, 'unreadable');
  assert.equal(classifyHistoryFile(JSON.stringify({ plays: [extendedRow] })).kind, 'unreadable');
});

test('resolveImportOutcome: zero Plays from basic export files asks for the Extended export', () => {
  const outcome = resolveImportOutcome({ qualifiedPlays: 0, skippedFiles: 2, basicExportFiles: 2 });
  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? '' : outcome.error, /Extended streaming history/);
});

test('resolveImportOutcome: zero Plays from unreadable files is an error naming the count', () => {
  const outcome = resolveImportOutcome({ qualifiedPlays: 0, skippedFiles: 3, basicExportFiles: 0 });
  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? '' : outcome.error, /3 files could not be read/);
});

test('resolveImportOutcome: zero qualified Plays in readable files is an error', () => {
  const outcome = resolveImportOutcome({ qualifiedPlays: 0, skippedFiles: 0, basicExportFiles: 0 });
  assert.equal(outcome.ok, false);
  assert.match(outcome.ok ? '' : outcome.error, /No Plays were imported/);
});

test('resolveImportOutcome: a partial import succeeds and reports the skipped files', () => {
  assert.deepEqual(resolveImportOutcome({ qualifiedPlays: 120, skippedFiles: 1, basicExportFiles: 0 }), {
    ok: true,
    skippedNote: '1 file was skipped because it is not Extended streaming history.',
  });
  assert.deepEqual(resolveImportOutcome({ qualifiedPlays: 120, skippedFiles: 0, basicExportFiles: 0 }), {
    ok: true,
    skippedNote: null,
  });
});

test('stepOnOpen: reopening after a completed import returns to the dropzone', () => {
  assert.equal(stepOnOpen('completed'), 'idle');
});

test('stepOnOpen: an upload in progress and an error are left as they are', () => {
  assert.equal(stepOnOpen('inspecting'), 'inspecting');
  assert.equal(stepOnOpen('stage1'), 'stage1');
  assert.equal(stepOnOpen('error'), 'error');
  assert.equal(stepOnOpen('idle'), 'idle');
});

test('UploadModal applies stepOnOpen when it is opened', async () => {
  const { readFileSync } = await import('node:fs');
  const source = readFileSync('src/components/modals/upload-modal/UploadModal.tsx', 'utf8');
  assert.match(source, /if \(isOpen\) setStep\(\(current\) => stepOnOpen\(current\)\);\s*\}, \[isOpen\]\);/);
});
