import type { StreamLogItem, StreamLogMetricsRaw } from "@/lib/types";
import { CATALOG } from "./catalog";
import { MOCK_DATA } from "./overview-data";

// ---------------------------------------------------------------------------
// Demo Mode Extended Stream Log Mock Data (Chunks 2 & 3: Plays 51 to 150)
// ---------------------------------------------------------------------------

function createMockStreamItem(
  id: string,
  timeStr: string,
  track: {
    id: string;
    name: string;
    artist: string;
    artistId?: string;
    album: string;
    albumId?: string;
    duration: string;
    albumImageUrl?: string | null;
  },
  dayGroup?: string,
  sessionGap?: { durationStr: string; sittingLabel: string }
): StreamLogItem {
  return {
    id,
    trackId: track.id,
    timeStr,
    title: track.name,
    artist: track.artist,
    artistId: track.artistId,
    album: track.album,
    albumId: track.albumId,
    duration: track.duration,
    albumImageUrl: track.albumImageUrl,
    dayGroup,
    sessionGap,
  };
}

const MOCK_STREAM_LOG_CHUNK_2: StreamLogItem[] = [
  // 07 SEP Afternoon Session (Continued from sl-50 18:54 -> gap 2h 24m)
  createMockStreamItem("sl-51", "16:30", CATALOG.radiohead_nude),
  createMockStreamItem("sl-52", "16:25", CATALOG.radiohead_reckoner),
  createMockStreamItem("sl-53", "16:20", CATALOG.frank_ocean_nikes),
  createMockStreamItem("sl-54", "16:15", CATALOG.frank_ocean_nights),
  createMockStreamItem("sl-55", "16:10", CATALOG.kendrick_king_kunta),
  createMockStreamItem("sl-56", "16:06", CATALOG.kendrick_money_trees),
  createMockStreamItem("sl-57", "16:00", CATALOG.phoebe_motion_sickness),
  createMockStreamItem("sl-58", "15:56", CATALOG.phoebe_kyoto),
  createMockStreamItem("sl-59", "15:52", CATALOG.pink_floyd_money),
  createMockStreamItem("sl-60", "15:46", CATALOG.daft_punk_instant_crush),
  createMockStreamItem("sl-61", "15:41", CATALOG.beatles_come_together),
  createMockStreamItem("sl-62", "15:36", CATALOG.taylor_swift_cardigan),

  // 06 SEP Evening Session
  createMockStreamItem("sl-63", "23:25", CATALOG.radiohead_paranoid_android, "06 SEP", { durationStr: "16H 11M", sittingLabel: "18 TRACKS · 1H 14M" }),
  createMockStreamItem("sl-64", "23:19", CATALOG.radiohead_karma_police),
  createMockStreamItem("sl-65", "23:14", CATALOG.frank_ocean_pink_white),
  createMockStreamItem("sl-66", "23:10", CATALOG.frank_ocean_ivy),
  createMockStreamItem("sl-67", "23:05", CATALOG.kendrick_alright),
  createMockStreamItem("sl-68", "23:01", CATALOG.phoebe_kyoto),
  createMockStreamItem("sl-69", "22:57", CATALOG.phoebe_i_know_the_end),
  createMockStreamItem("sl-70", "22:51", CATALOG.fleetwood_dreams),
  createMockStreamItem("sl-71", "22:47", CATALOG.fleetwood_the_chain),
  createMockStreamItem("sl-72", "22:42", CATALOG.pink_floyd_time),
  createMockStreamItem("sl-73", "22:35", CATALOG.pink_floyd_money),
  createMockStreamItem("sl-74", "22:29", CATALOG.daft_punk_get_lucky),
  createMockStreamItem("sl-75", "22:25", CATALOG.daft_punk_instant_crush),
  createMockStreamItem("sl-76", "22:20", CATALOG.beatles_come_together),
  createMockStreamItem("sl-77", "22:16", CATALOG.beatles_here_comes_the_sun),
  createMockStreamItem("sl-78", "22:12", CATALOG.billie_eilish_bad_guy),
  createMockStreamItem("sl-79", "22:08", CATALOG.arctic_monkeys_do_i_wanna_know),
  createMockStreamItem("sl-80", "22:04", CATALOG.beach_house_space_song),

  // 06 SEP Afternoon Session
  createMockStreamItem("sl-81", "15:45", CATALOG.tame_impala_less_i_know, undefined, { durationStr: "6H 19M", sittingLabel: "20 TRACKS · 1H 22M" }),
  createMockStreamItem("sl-82", "15:41", CATALOG.nirvana_teen_spirit),
  createMockStreamItem("sl-83", "15:36", CATALOG.david_bowie_heroes),
  createMockStreamItem("sl-84", "15:31", CATALOG.michael_jackson_billie_jean),
  createMockStreamItem("sl-85", "15:26", CATALOG.queen_bohemian_rhapsody),
  createMockStreamItem("sl-86", "15:20", CATALOG.lorde_ribs),
  createMockStreamItem("sl-87", "15:16", CATALOG.beach_boys_god_only_knows),
  createMockStreamItem("sl-88", "15:13", CATALOG.led_zeppelin_stairway),
  createMockStreamItem("sl-89", "15:05", CATALOG.radiohead_weird_fishes),
  createMockStreamItem("sl-90", "15:00", CATALOG.radiohead_15_step),
  createMockStreamItem("sl-91", "14:56", CATALOG.radiohead_nude),
  createMockStreamItem("sl-92", "14:52", CATALOG.radiohead_reckoner),
  createMockStreamItem("sl-93", "14:47", CATALOG.frank_ocean_pink_white),
  createMockStreamItem("sl-94", "14:44", CATALOG.frank_ocean_nikes),
  createMockStreamItem("sl-95", "14:38", CATALOG.kendrick_alright),
  createMockStreamItem("sl-96", "14:34", CATALOG.kendrick_king_kunta),
  createMockStreamItem("sl-97", "14:30", CATALOG.phoebe_kyoto),
  createMockStreamItem("sl-98", "14:27", CATALOG.fleetwood_dreams),
  createMockStreamItem("sl-99", "14:23", CATALOG.daft_punk_get_lucky),
  createMockStreamItem("sl-100", "14:19", CATALOG.pink_floyd_time),
];

const MOCK_STREAM_LOG_CHUNK_3: StreamLogItem[] = [
  // 05 SEP Evening Session
  createMockStreamItem("sl-101", "22:40", CATALOG.taylor_swift_exile, "05 SEP", { durationStr: "15H 39M", sittingLabel: "20 TRACKS · 1H 18M" }),
  createMockStreamItem("sl-102", "22:35", CATALOG.taylor_swift_cardigan),
  createMockStreamItem("sl-103", "22:31", CATALOG.beach_house_space_song),
  createMockStreamItem("sl-104", "22:27", CATALOG.tame_impala_less_i_know),
  createMockStreamItem("sl-105", "22:23", CATALOG.arctic_monkeys_do_i_wanna_know),
  createMockStreamItem("sl-106", "22:18", CATALOG.nirvana_teen_spirit),
  createMockStreamItem("sl-107", "22:13", CATALOG.david_bowie_heroes),
  createMockStreamItem("sl-108", "22:08", CATALOG.michael_jackson_billie_jean),
  createMockStreamItem("sl-109", "22:03", CATALOG.queen_bohemian_rhapsody),
  createMockStreamItem("sl-110", "21:57", CATALOG.lorde_ribs),
  createMockStreamItem("sl-111", "21:53", CATALOG.beach_boys_god_only_knows),
  createMockStreamItem("sl-112", "21:50", CATALOG.led_zeppelin_stairway),
  createMockStreamItem("sl-113", "21:42", CATALOG.beatles_here_comes_the_sun),
  createMockStreamItem("sl-114", "21:39", CATALOG.beatles_come_together),
  createMockStreamItem("sl-115", "21:35", CATALOG.daft_punk_get_lucky),
  createMockStreamItem("sl-116", "21:31", CATALOG.pink_floyd_money),
  createMockStreamItem("sl-117", "21:25", CATALOG.pink_floyd_time),
  createMockStreamItem("sl-118", "21:18", CATALOG.fleetwood_the_chain),
  createMockStreamItem("sl-119", "21:14", CATALOG.fleetwood_dreams),
  createMockStreamItem("sl-120", "21:10", CATALOG.phoebe_kyoto),

  // 05 SEP Afternoon Session
  createMockStreamItem("sl-121", "14:15", CATALOG.kendrick_money_trees, undefined, { durationStr: "6H 55M", sittingLabel: "15 TRACKS · 58M" }),
  createMockStreamItem("sl-122", "14:09", CATALOG.kendrick_king_kunta),
  createMockStreamItem("sl-123", "14:05", CATALOG.kendrick_alright),
  createMockStreamItem("sl-124", "14:01", CATALOG.frank_ocean_nights),
  createMockStreamItem("sl-125", "13:56", CATALOG.frank_ocean_ivy),
  createMockStreamItem("sl-126", "13:52", CATALOG.frank_ocean_nikes),
  createMockStreamItem("sl-127", "13:46", CATALOG.frank_ocean_pink_white),
  createMockStreamItem("sl-128", "13:43", CATALOG.radiohead_karma_police),
  createMockStreamItem("sl-129", "13:39", CATALOG.radiohead_paranoid_android),
  createMockStreamItem("sl-130", "13:32", CATALOG.radiohead_reckoner),
  createMockStreamItem("sl-131", "13:28", CATALOG.radiohead_nude),
  createMockStreamItem("sl-132", "13:23", CATALOG.radiohead_15_step),
  createMockStreamItem("sl-133", "13:19", CATALOG.radiohead_weird_fishes),
  createMockStreamItem("sl-134", "13:14", CATALOG.beach_boys_god_only_knows),
  createMockStreamItem("sl-135", "13:11", CATALOG.lorde_ribs),

  // 04 SEP Evening Session (Terminal Genesis)
  createMockStreamItem("sl-136", "23:55", CATALOG.queen_bohemian_rhapsody, "04 SEP", { durationStr: "13H 16M", sittingLabel: "15 TRACKS · 1H 02M" }),
  createMockStreamItem("sl-137", "23:49", CATALOG.michael_jackson_billie_jean),
  createMockStreamItem("sl-138", "23:44", CATALOG.david_bowie_heroes),
  createMockStreamItem("sl-139", "23:40", CATALOG.nirvana_teen_spirit),
  createMockStreamItem("sl-140", "23:35", CATALOG.tame_impala_less_i_know),
  createMockStreamItem("sl-141", "23:31", CATALOG.beach_house_space_song),
  createMockStreamItem("sl-142", "23:27", CATALOG.arctic_monkeys_do_i_wanna_know),
  createMockStreamItem("sl-143", "23:22", CATALOG.billie_eilish_bad_guy),
  createMockStreamItem("sl-144", "23:19", CATALOG.taylor_swift_exile),
  createMockStreamItem("sl-145", "23:15", CATALOG.taylor_swift_cardigan),
  createMockStreamItem("sl-146", "23:11", CATALOG.beatles_here_comes_the_sun),
  createMockStreamItem("sl-147", "23:08", CATALOG.beatles_come_together),
  createMockStreamItem("sl-148", "23:04", CATALOG.daft_punk_instant_crush),
  createMockStreamItem("sl-149", "22:59", CATALOG.daft_punk_get_lucky),
  createMockStreamItem("sl-150", "22:53", CATALOG.pink_floyd_money),
];

export const ALL_MOCK_STREAM_LOG_ENTRIES: StreamLogItem[] = [
  ...MOCK_DATA.streamLog.entries,
  ...MOCK_STREAM_LOG_CHUNK_2,
  ...MOCK_STREAM_LOG_CHUNK_3,
];

// Initialize ISO timestamps for all mock entries
let currentMockDay = "2026-09-09";
for (const entry of ALL_MOCK_STREAM_LOG_ENTRIES) {
  if (entry.dayGroup === "09 SEP") currentMockDay = "2026-09-09";
  else if (entry.dayGroup === "08 SEP") currentMockDay = "2026-09-08";
  else if (entry.dayGroup === "07 SEP") currentMockDay = "2026-09-07";
  else if (entry.dayGroup === "06 SEP") currentMockDay = "2026-09-06";
  else if (entry.dayGroup === "05 SEP") currentMockDay = "2026-09-05";
  else if (entry.dayGroup === "04 SEP") currentMockDay = "2026-09-04";

  if (!entry.playedAt) {
    entry.playedAt = `${currentMockDay}T${entry.timeStr}:00.000Z`;
  }
}

export function getMockStreamLog(
  limit = 50,
  cursor?: string,
  cursorId?: string,
  prevDayGroup?: string,
  prevPlayedAt?: string
): {
  rawMetrics: StreamLogMetricsRaw;
  metrics: [string, string, string, string];
  entries: StreamLogItem[];
  hasMore: boolean;
  nextCursor: string | null;
  nextCursorId: string | null;
  lastSyncedAt: string;
} {
  let startIndex = 0;
  if (cursorId) {
    const idx = ALL_MOCK_STREAM_LOG_ENTRIES.findIndex((e) => e.id === cursorId);
    if (idx !== -1) {
      startIndex = idx + 1;
    }
  } else if (cursor) {
    const idx = ALL_MOCK_STREAM_LOG_ENTRIES.findIndex((e) => e.playedAt === cursor);
    if (idx !== -1) {
      startIndex = idx + 1;
    }
  }

  const paged = ALL_MOCK_STREAM_LOG_ENTRIES.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < ALL_MOCK_STREAM_LOG_ENTRIES.length;
  const lastEntry = paged[paged.length - 1];

  // Cross-chunk boundary stitching
  const entries: StreamLogItem[] = paged.map((entry, i) => {
    const item = { ...entry };
    if (i === 0) {
      // 1. Boundary session gap: if prevPlayedAt is present and gap > 30 mins
      if (prevPlayedAt && item.playedAt) {
        const gapMs = new Date(prevPlayedAt).getTime() - new Date(item.playedAt).getTime();
        if (gapMs > 30 * 60 * 1000) {
          const diffMinutes = Math.floor(gapMs / (60 * 1000));
          const hours = Math.floor(diffMinutes / 60);
          const mins = diffMinutes % 60;
          const durationStr = hours > 0 ? `${hours}H ${mins}M` : `${mins}M`;
          item.sessionGap = {
            durationStr,
            sittingLabel: "PREVIOUS SESSION",
          };
        }
      }
      // 2. Suppress duplicate dayGroup if it matches prevDayGroup
      if (prevDayGroup && item.dayGroup === prevDayGroup) {
        item.dayGroup = undefined;
      }
    }
    return item;
  });

  return {
    rawMetrics: {
      totalPlays: 150,
      uniqueTracks: 84,
      uniqueArtists: 34,
      streakDays: 14,
    },
    metrics: ["150", "84", "34", "14 DAYS"],
    entries,
    hasMore,
    nextCursor: lastEntry?.playedAt ?? null,
    nextCursorId: lastEntry?.id ?? null,
    lastSyncedAt: new Date().toISOString(),
  };
}

