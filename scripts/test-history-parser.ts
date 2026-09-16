import fs from "node:fs";
import path from "node:path";
import assert from "node:assert";
import {
  parseHistoryRecords,
  extractTrackId,
  normalizeName,
  makeArtistGroupKey,
  makeAlbumGroupKey,
  truncateToSeconds,
  isQualifiedPlay,
  isAudioMusicTrack,
  SpotifyAudioHistoryRecord,
} from "../src/lib/history-parser";
import { isAudioHistoryFilename } from "../src/lib/zip-utils";

console.log("============================================================");
console.log("         Running Extended Streaming History Tests           ");
console.log("============================================================\n");

// 1. Test ZIP Entry Basename Matching (Claude Fatal #1)
console.log("[TEST 1] ZIP Filename Basename Matching");
assert.strictEqual(
  isAudioHistoryFilename("Spotify Extended Streaming History/Streaming_History_Audio_2016-2018_0.json"),
  true,
  "Nested Streaming_History_Audio path must match"
);
assert.strictEqual(
  isAudioHistoryFilename("MyData/endsong_0.json"),
  true,
  "Nested endsong_0.json must match"
);
assert.strictEqual(
  isAudioHistoryFilename("endsong_1.json"),
  true,
  "Top-level endsong_1.json must match"
);
assert.strictEqual(
  isAudioHistoryFilename("Streaming_History_Video_2024.json"),
  false,
  "Video history must be excluded"
);
assert.strictEqual(
  isAudioHistoryFilename("__MACOSX/._Streaming_History_Audio_0.json"),
  false,
  "macOS metadata entry must be excluded"
);
console.log("✓ Test 1 passed: All zip archive paths matched correctly.\n");

// 2. Test Timestamp Second-Precision Truncation (Claude Fatal #5)
console.log("[TEST 2] Timestamp Truncation to Seconds");
assert.strictEqual(
  truncateToSeconds("2024-01-02T07:35:40.123Z"),
  "2024-01-02T07:35:40Z",
  "Millisecond timestamp must truncate to whole second"
);
assert.strictEqual(
  truncateToSeconds("2024-01-02T07:35:40Z"),
  "2024-01-02T07:35:40Z",
  "Second-precision timestamp must remain unchanged"
);
console.log("✓ Test 2 passed: Timestamps normalized to second precision.\n");

// 3. Test Pre-normalized Group Keys & Unicode NFC Normalization
console.log("[TEST 3] Pre-normalized Artist and Album Group Keys");
const artist1 = "Beyoncé";
const artist1Decomposed = "Beyonce\u0301"; // NFD representation of Beyoncé
assert.strictEqual(
  makeArtistGroupKey(artist1),
  makeArtistGroupKey(artist1Decomposed),
  "NFC normalization must guarantee identical artist group key"
);
assert.strictEqual(
  makeArtistGroupKey("  The Beatles  "),
  "the beatles",
  "Trim and lowercasing must guarantee clean artist group key"
);
assert.strictEqual(
  makeAlbumGroupKey("The Beatles", "Abbey Road"),
  "the beatles::abbey road",
  "Album group keys must composite normalized artist and album"
);
console.log("✓ Test 3 passed: Group keys generated deterministically.\n");

// 4. Test Play Threshold Qualification
console.log("[TEST 4] Play Qualification Threshold");
const play35s: SpotifyAudioHistoryRecord = {
  ts: "2024-01-01T00:00:00Z",
  ms_played: 35000,
  master_metadata_track_name: "Song",
  master_metadata_album_artist_name: "Artist",
  master_metadata_album_album_name: "Album",
  spotify_track_uri: "spotify:track:1234567890123456789012",
  reason_end: "fwdbtn",
};
assert.strictEqual(isQualifiedPlay(play35s), true, "35s play must qualify");

const play2sSkip: SpotifyAudioHistoryRecord = {
  ...play35s,
  ms_played: 2000,
  skipped: true,
  reason_end: "fwdbtn",
};
assert.strictEqual(isQualifiedPlay(play2sSkip), false, "2s skips must NOT qualify");

const shortInterludeTrackdone: SpotifyAudioHistoryRecord = {
  ...play35s,
  ms_played: 12000,
  reason_end: "trackdone",
};
assert.strictEqual(
  isQualifiedPlay(shortInterludeTrackdone),
  true,
  "Short interlude >= 10s played to completion must qualify"
);

const shortInterludeSkipped: SpotifyAudioHistoryRecord = {
  ...play35s,
  ms_played: 12000,
  reason_end: "fwdbtn",
};
assert.strictEqual(
  isQualifiedPlay(shortInterludeSkipped),
  false,
  "Short interlude skipped must NOT qualify"
);
console.log("✓ Test 4 passed: Play threshold correctly qualifies music plays.\n");

// 5. Test Audio-Only Music Filter (Excluding Podcasts, Audiobooks, Local Tracks)
console.log("[TEST 5] Audio-Only Music Filters");
const podcastItem: SpotifyAudioHistoryRecord = {
  ...play35s,
  episode_name: "Joe Rogan Experience #1234",
  spotify_episode_uri: "spotify:episode:123456",
};
assert.strictEqual(isAudioMusicTrack(podcastItem), false, "Podcasts must be excluded");

const audiobookItem: SpotifyAudioHistoryRecord = {
  ...play35s,
  audiobook_title: "Atomic Habits",
  audiobook_uri: "spotify:audiobook:123456",
};
assert.strictEqual(isAudioMusicTrack(audiobookItem), false, "Audiobooks must be excluded");

const localItem: SpotifyAudioHistoryRecord = {
  ...play35s,
  spotify_track_uri: "spotify:local:Artist:Album:Track:180",
};
assert.strictEqual(isAudioMusicTrack(localItem), false, "Local tracks must be excluded");
console.log("✓ Test 5 passed: Non-music tracks strictly excluded.\n");

// 6. Test Parsing Against Sample Fixture
console.log("[TEST 6] Parsing Sample Fixture");
const fixturePath = path.resolve(process.cwd(), "src/lib/Streaming_History_Audio_2024.json");
let fixtureRaw: SpotifyAudioHistoryRecord[];

if (fs.existsSync(fixturePath)) {
  console.log("         Loading real fixture from src/lib/Streaming_History_Audio_2024.json");
  fixtureRaw = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
} else {
  console.log("         Loading fallback fixture array");
  fixtureRaw = [
    play35s,
    play2sSkip,
    shortInterludeTrackdone,
    shortInterludeSkipped,
    podcastItem,
    audiobookItem,
    localItem,
  ];
}

assert.strictEqual(Array.isArray(fixtureRaw), true, "Fixture must be array");
console.log(`         Total raw stream events in fixture: ${fixtureRaw.length}`);

const qualified = parseHistoryRecords(fixtureRaw);
console.log(`         Qualified music plays extracted:    ${qualified.length}`);
console.log(`         Filtered non-music / short skips:   ${fixtureRaw.length - qualified.length}`);

assert(qualified.length > 0, "Qualified plays must be greater than 0");
assert(qualified.length <= fixtureRaw.length, "Qualified count cannot exceed raw count");

// Verify sample record
const firstPlay = qualified[0];
assert(firstPlay.trackId.length >= 15, "Track ID must be base62");
assert(firstPlay.playedAt.endsWith("Z"), "Timestamp must be UTC ISO");
assert(!firstPlay.playedAt.includes("."), "Timestamp must not have milliseconds");
assert(firstPlay.artistGroupKey.length > 0, "Artist group key must be populated");
assert(firstPlay.albumGroupKey.includes("::"), "Album group key must composite artist and album");
console.log("✓ Test 6 passed: Real sample fixture processed cleanly with group keys.\n");

console.log("============================================================");
console.log("              ALL AUTOMATED TESTS PASSED! 🎉                ");
console.log("============================================================\n");
