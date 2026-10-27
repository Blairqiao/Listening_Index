import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSessions } from '../src/lib/session-calculation';
const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1) + minutes * 60_000).toISOString();
const play = (id: string, minutes: number, durationMs = 300_000, trackId = id, artist = 'Artist', albumId: string | null = null) => ({id, playedAt: at(minutes), durationMs, trackId, title:'Same', artist, album:'Same', albumId});
test('Session boundaries preserve exactly 30 minutes and stable persisted ID ordering', () => {
  const sessions = calculateSessions([play('10', 30),play('2', 30),play('1',0),play('11',61)]);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions[1].plays.map(p => p.id), ['1','2','10']);
  assert.equal(sessions[1].id, '1');
});
test('Session runtime includes the earliest duration and summed durations, with zero for empty input', () => {
  assert.deepEqual(calculateSessions([]), []);
  assert.equal(calculateSessions([play('1',0),play('2',5)])[0].runtimeMs,600_000);
  assert.equal(calculateSessions([play('1',0),play('2',0)])[0].runtimeMs,600_000);
  assert.equal(calculateSessions([play('1',0,NaN)])[0].runtimeMs,0);
  assert.equal(calculateSessions([play('1',0,-1)])[0].runtimeMs,0);
});
test('Session analysis uses Track IDs and Artist-qualified Album identities', () => {
  const session = calculateSessions([play('1',0,1,'a','One'),play('2',1,1,'b','Two'),play('3',2,1,'b','Two')])[0];
  assert.equal(session.analysis.topTrack?.id,'b');
  assert.equal(session.analysis.topTrack?.count,2);
  assert.equal(session.analysis.topAlbum.count,2);
});
