import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { clockToMs, resolveDisplayTrack, DEFAULT_FALLBACK_TRACK } from "../src/components/LivePlayerView";

test("LivePlayerView - clockToMs parses clock strings to milliseconds", () => {
  assert.equal(clockToMs("0:05"), 5000);
  assert.equal(clockToMs("5:18"), 318000);
  assert.equal(clockToMs("1:05"), 65000);
  assert.equal(clockToMs("12:18"), 738000);
  assert.equal(clockToMs("1:12:18"), 4338000);
  assert.equal(clockToMs("0:00"), 0);
  assert.equal(clockToMs(""), 0);
});

test("LivePlayerView - DEFAULT_FALLBACK_TRACK is set to Radiohead - Weird Fishes / Arpeggi", () => {
  assert.equal(DEFAULT_FALLBACK_TRACK.name, "Weird Fishes / Arpeggi");
  assert.equal(DEFAULT_FALLBACK_TRACK.artist, "Radiohead");
  assert.equal(DEFAULT_FALLBACK_TRACK.album, "In Rainbows");
  assert.equal(DEFAULT_FALLBACK_TRACK.durationMs, 318000);
});

test("LivePlayerView - resolveDisplayTrack reflects latestPlay duration when player is unlinked", () => {
  // Case 1: Unlinked (duration = 0), latestPlay has durationMs
  const track1 = resolveDisplayTrack({
    currentTrack: null,
    duration: 0,
    latestPlay: {
      title: "Jigsaw Falling Into Place",
      artist: "Radiohead",
      album: "In Rainbows",
      albumImageUrl: "https://example.com/jigsaw.jpg",
      durationMs: 249000,
      duration: "4:09",
    },
  });
  assert.equal(track1.name, "Jigsaw Falling Into Place");
  assert.equal(track1.durationMs, 249000, "Must reflect latestPlay.durationMs when unlinked");

  // Case 2: Unlinked (duration = 0), latestPlay only has duration string "3:45"
  const track2 = resolveDisplayTrack({
    currentTrack: null,
    duration: 0,
    latestPlay: {
      title: "Fake Plastic Trees",
      artist: "Radiohead",
      album: "The Bends",
      albumImageUrl: "https://example.com/bends.jpg",
      duration: "4:50",
    },
  });
  assert.equal(track2.name, "Fake Plastic Trees");
  assert.equal(track2.durationMs, 290000, "Must parse latestPlay.duration clock string when durationMs is not provided");

  // Case 3: Linked & active (duration > 0), active playback duration wins
  const track3 = resolveDisplayTrack({
    currentTrack: {
      id: "abc",
      name: "Active Song",
      artists: [{ name: "Active Artist" }],
      album: { name: "Active Album", images: [{ url: "https://example.com/active.jpg" }] },
    },
    duration: 185000,
    latestPlay: {
      title: "Previous Song",
      artist: "Previous Artist",
      album: "Previous Album",
      durationMs: 300000,
    },
  });
  assert.equal(track3.name, "Active Song");
  assert.equal(track3.durationMs, 185000, "Active playback duration must win when > 0");

  // Case 4: No active track, no latestPlay, fallback to DEFAULT_FALLBACK_TRACK
  const track4 = resolveDisplayTrack({
    currentTrack: null,
    duration: 0,
    latestPlay: null,
  });
  assert.equal(track4.name, "Weird Fishes / Arpeggi");
  assert.equal(track4.durationMs, 318000, "Must fall back to default track duration");
});

test("StreamLog queries & mock data - populates durationMs on stream log items", () => {
  const streamLogQueryPath = path.resolve(__dirname, "../src/lib/db/queries/stream-log.ts");
  const querySource = fs.readFileSync(streamLogQueryPath, "utf-8");
  assert.match(
    querySource,
    /durationMs:\s*row\.duration_ms/,
    "stream-log.ts must populate durationMs: row.duration_ms in entries"
  );

  const mockTypesPath = path.resolve(__dirname, "../src/lib/mock-listening-data.ts");
  const typesSource = fs.readFileSync(mockTypesPath, "utf-8");
  assert.match(
    typesSource,
    /durationMs\?:/,
    "StreamLogItem must declare durationMs?: number"
  );
});
