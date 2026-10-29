import type { TrackSummary, MockListeningData, ActivityBucket } from "@/lib/types";
import { CATALOG } from "./catalog";

// ---------------------------------------------------------------------------
// Top 10 Ranked Tracks Across Ranges (Showcasing all 6 drift types: ·, +1, +2, -1, -2, NEW)
// ---------------------------------------------------------------------------

const TOP_TRACKS_1D: TrackSummary[] = [
  { ...CATALOG.radiohead_weird_fishes, rank: "01", drift: "·", plays: 38 },
  { ...CATALOG.frank_ocean_pink_white, rank: "02", drift: "+1", plays: 34 },
  { ...CATALOG.kendrick_alright, rank: "03", drift: "-1", plays: 31 },
  { ...CATALOG.phoebe_kyoto, rank: "04", drift: "+2", plays: 28 },
  { ...CATALOG.fleetwood_dreams, rank: "05", drift: "-2", plays: 24 },
  { ...CATALOG.daft_punk_get_lucky, rank: "06", drift: "NEW", plays: 22 },
  { ...CATALOG.pink_floyd_time, rank: "07", drift: "·", plays: 19 },
  { ...CATALOG.beatles_come_together, rank: "08", drift: "+1", plays: 17 },
  { ...CATALOG.taylor_swift_cardigan, rank: "09", drift: "-1", plays: 15 },
  { ...CATALOG.billie_eilish_bad_guy, rank: "10", drift: "NEW", plays: 13 },
];

const TOP_TRACKS_1W: TrackSummary[] = [
  { ...CATALOG.radiohead_weird_fishes, rank: "01", drift: "·", plays: 64 },
  { ...CATALOG.kendrick_alright, rank: "02", drift: "+1", plays: 58 },
  { ...CATALOG.frank_ocean_pink_white, rank: "03", drift: "-1", plays: 52 },
  { ...CATALOG.pink_floyd_time, rank: "04", drift: "+2", plays: 46 },
  { ...CATALOG.fleetwood_dreams, rank: "05", drift: "·", plays: 43 },
  { ...CATALOG.phoebe_kyoto, rank: "06", drift: "-2", plays: 39 },
  { ...CATALOG.daft_punk_get_lucky, rank: "07", drift: "+1", plays: 35 },
  { ...CATALOG.beatles_come_together, rank: "08", drift: "-1", plays: 32 },
  { ...CATALOG.arctic_monkeys_do_i_wanna_know, rank: "09", drift: "NEW", plays: 28 },
  { ...CATALOG.beach_house_space_song, rank: "10", drift: "NEW", plays: 25 },
];

const TOP_TRACKS_1M: TrackSummary[] = [
  { ...CATALOG.frank_ocean_pink_white, rank: "01", drift: "+2", plays: 184 },
  { ...CATALOG.radiohead_weird_fishes, rank: "02", drift: "-1", plays: 172 },
  { ...CATALOG.kendrick_alright, rank: "03", drift: "-1", plays: 156 },
  { ...CATALOG.pink_floyd_time, rank: "04", drift: "·", plays: 142 },
  { ...CATALOG.phoebe_kyoto, rank: "05", drift: "+1", plays: 128 },
  { ...CATALOG.tame_impala_less_i_know, rank: "06", drift: "+2", plays: 114 },
  { ...CATALOG.fleetwood_dreams, rank: "07", drift: "-2", plays: 106 },
  { ...CATALOG.daft_punk_get_lucky, rank: "08", drift: "·", plays: 98 },
  { ...CATALOG.beatles_come_together, rank: "09", drift: "-1", plays: 89 },
  { ...CATALOG.nirvana_teen_spirit, rank: "10", drift: "NEW", plays: 82 },
];

const TOP_TRACKS_6M: TrackSummary[] = [
  { ...CATALOG.radiohead_weird_fishes, rank: "01", drift: "·", plays: 890 },
  { ...CATALOG.frank_ocean_pink_white, rank: "02", drift: "+1", plays: 840 },
  { ...CATALOG.kendrick_alright, rank: "03", drift: "-1", plays: 760 },
  { ...CATALOG.pink_floyd_time, rank: "04", drift: "+1", plays: 690 },
  { ...CATALOG.tame_impala_less_i_know, rank: "05", drift: "+2", plays: 620 },
  { ...CATALOG.beatles_come_together, rank: "06", drift: "-2", plays: 580 },
  { ...CATALOG.fleetwood_dreams, rank: "07", drift: "-1", plays: 540 },
  { ...CATALOG.daft_punk_get_lucky, rank: "08", drift: "·", plays: 490 },
  { ...CATALOG.nirvana_teen_spirit, rank: "09", drift: "+1", plays: 450 },
  { ...CATALOG.david_bowie_heroes, rank: "10", drift: "NEW", plays: 410 },
];

const TOP_TRACKS_1Y: TrackSummary[] = [
  { ...CATALOG.radiohead_weird_fishes, rank: "01", drift: "·", plays: 1940 },
  { ...CATALOG.frank_ocean_pink_white, rank: "02", drift: "·", plays: 1820 },
  { ...CATALOG.pink_floyd_time, rank: "03", drift: "+1", plays: 1650 },
  { ...CATALOG.kendrick_alright, rank: "04", drift: "-1", plays: 1580 },
  { ...CATALOG.beatles_come_together, rank: "05", drift: "+2", plays: 1420 },
  { ...CATALOG.tame_impala_less_i_know, rank: "06", drift: "-1", plays: 1310 },
  { ...CATALOG.fleetwood_dreams, rank: "07", drift: "-1", plays: 1220 },
  { ...CATALOG.daft_punk_get_lucky, rank: "08", drift: "·", plays: 1140 },
  { ...CATALOG.nirvana_teen_spirit, rank: "09", drift: "+1", plays: 980 },
  { ...CATALOG.michael_jackson_billie_jean, rank: "10", drift: "NEW", plays: 890 },
];

const TOP_TRACKS_ALL: TrackSummary[] = [
  { ...CATALOG.radiohead_weird_fishes, rank: "01", drift: "·", plays: 4120 },
  { ...CATALOG.frank_ocean_pink_white, rank: "02", drift: "·", plays: 3890 },
  { ...CATALOG.pink_floyd_time, rank: "03", drift: "·", plays: 3410 },
  { ...CATALOG.kendrick_alright, rank: "04", drift: "+1", plays: 3120 },
  { ...CATALOG.beatles_come_together, rank: "05", drift: "-1", plays: 2940 },
  { ...CATALOG.fleetwood_dreams, rank: "06", drift: "+1", plays: 2680 },
  { ...CATALOG.tame_impala_less_i_know, rank: "07", drift: "-1", plays: 2450 },
  { ...CATALOG.daft_punk_get_lucky, rank: "08", drift: "·", plays: 2210 },
  { ...CATALOG.led_zeppelin_stairway, rank: "09", drift: "+2", plays: 1980 },
  { ...CATALOG.queen_bohemian_rhapsody, rank: "10", drift: "NEW", plays: 1840 },
];

// ---------------------------------------------------------------------------
// Exported MOCK_DATA
// ---------------------------------------------------------------------------

export const MOCK_DATA: MockListeningData = {
  overview: {
    "1d": {
      logStartDate: "08 SEP 2026",
      rawMetrics: {
        totalMs: 12900000,
        trackCount: 42,
        artistCount: 20,
        elapsedDays: 1,
      },
      metrics: ["215", "42", "20", "3.6h"],
      topTracks: TOP_TRACKS_1D,
      topArtists: [
        { rank: "01", name: "Radiohead", id: "4Z8W4fKeB5YxbusRsdQVPb", count: 12 },
        { rank: "02", name: "Frank Ocean", id: "2h93pZq0e7k5yf4Y40u9UR", count: 10 },
        { rank: "03", name: "Kendrick Lamar", id: "2YZyLoL8N0Wb9xBt1NhZWg", count: 7 },
        { rank: "04", name: "Phoebe Bridgers", id: "1r1uxoy19fzMxunt3ONAkG", count: 6 },
        { rank: "05", name: "Daft Punk", id: "4tZwfgrHOc3mvqYxwDoOD1", count: 5 },
      ],
      topAlbums: [
        { rank: "01", name: "In Rainbows", artist: "Radiohead", id: "7vd91cWv27mKrnG67vR4iR", artistId: "4Z8W4fKeB5YxbusRsdQVPb", count: 8 },
        { rank: "02", name: "Blonde", artist: "Frank Ocean", id: "3mH6qwIy9crq0I9YQbOuDf", artistId: "2h93pZq0e7k5yf4Y40u9UR", count: 7 },
        { rank: "03", name: "To Pimp a Butterfly", artist: "Kendrick Lamar", id: "7ycBtnsMtyVbbw3fMwR2nM", artistId: "2YZyLoL8N0Wb9xBt1NhZWg", count: 5 },
        { rank: "04", name: "Punisher", artist: "Phoebe Bridgers", id: "2xGQEAlDAw7whm4vvt3WvX", artistId: "1r1uxoy19fzMxunt3ONAkG", count: 4 },
        { rank: "05", name: "Random Access Memories", artist: "Daft Punk", id: "4m2880jivSbbyEGAKfITCa", artistId: "4tZwfgrHOc3mvqYxwDoOD1", count: 4 },
      ],
      activityCadence: (() => {
        const counts = [2, 1, 0, 0, 0, 0, 0, 1, 3, 5, 8, 4, 3, 6, 7, 2, 4, 9, 12, 14, 8, 6, 3, 1];
        const base = new Date("2026-09-08T23:00:00.000Z");
        return Array.from({ length: 24 }, (_, idx) => {
          const hoursAgo = 23 - idx;
          const d = new Date(base.getTime() - hoursAgo * 3600000);
          d.setUTCMinutes(0, 0, 0);
          const end = new Date(d.getTime() + 3600000 - 1);
          const h = d.getUTCHours();
          return {
            date: `${h < 10 ? `0${h}` : h}:00`,
            startTime: d.toISOString(),
            endTime: end.toISOString(),
            count: counts[idx % counts.length],
          };
        });
      })(),
    },
    "1w": {
      logStartDate: "02 SEP 2026",
      rawMetrics: {
        totalMs: 91200000,
        trackCount: 194,
        artistCount: 58,
        elapsedDays: 7,
      },
      metrics: ["1,520", "194", "58", "3.6h"],
      topTracks: TOP_TRACKS_1W,
      topArtists: [
        { rank: "01", name: "Radiohead", id: "4Z8W4fKeB5YxbusRsdQVPb", count: 42 },
        { rank: "02", name: "Frank Ocean", id: "2h93pZq0e7k5yf4Y40u9UR", count: 36 },
        { rank: "03", name: "Kendrick Lamar", id: "2YZyLoL8N0Wb9xBt1NhZWg", count: 29 },
        { rank: "04", name: "Pink Floyd", id: "0k17h0D3J5VfsdmQ1iZtE9", count: 24 },
        { rank: "05", name: "Fleetwood Mac", id: "08GQAI4e5rBaRujQwE7AVn", count: 21 },
      ],
      topAlbums: [
        { rank: "01", name: "In Rainbows", artist: "Radiohead", id: "7vd91cWv27mKrnG67vR4iR", artistId: "4Z8W4fKeB5YxbusRsdQVPb", count: 26 },
        { rank: "02", name: "Blonde", artist: "Frank Ocean", id: "3mH6qwIy9crq0I9YQbOuDf", artistId: "2h93pZq0e7k5yf4Y40u9UR", count: 22 },
        { rank: "03", name: "The Dark Side of the Moon", artist: "Pink Floyd", id: "4LH4d3cOWNNXdsqFd42wzg", artistId: "0k17h0D3J5VfsdmQ1iZtE9", count: 18 },
        { rank: "04", name: "To Pimp a Butterfly", artist: "Kendrick Lamar", id: "7ycBtnsMtyVbbw3fMwR2nM", artistId: "2YZyLoL8N0Wb9xBt1NhZWg", count: 16 },
        { rank: "05", name: "Rumours", artist: "Fleetwood Mac", id: "1BZhsjlBYzDbKyJdYBMxev", artistId: "08GQAI4e5rBaRujQwE7AVn", count: 14 },
      ],
      activityCadence: (() => {
        const blocks: ActivityBucket[] = [];
        const BLOCK_TIMES = ["00:00–06:00", "06:00–12:00", "12:00–18:00", "18:00–24:00"];
        const dayLabels = ["03 SEP", "04 SEP", "05 SEP", "06 SEP", "07 SEP", "08 SEP", "09 SEP"];
        for (let i = 0; i < 7; i++) {
          const dayNum = i + 3;
          for (let b = 0; b < 4; b++) {
            const count = Math.max(1, Math.round(Math.sin((i * 4 + b) * 0.6) * 10 + 9));
            const startHour = b * 6;
            const startTime = new Date(Date.UTC(2026, 8, dayNum, startHour, 0, 0, 0)).toISOString();
            const endTime = b === 3
              ? new Date(Date.UTC(2026, 8, dayNum, 23, 59, 59, 999)).toISOString()
              : new Date(Date.UTC(2026, 8, dayNum, startHour + 6, 0, 0, 0)).toISOString();
            blocks.push({
              date: `${dayLabels[i]} ${BLOCK_TIMES[b]}`,
              startTime,
              endTime,
              count,
              isMarker: b === 0,
              markerLabel: b === 0 ? dayLabels[i].split(" ")[0] : undefined,
            });
          }
        }
        return blocks;
      })(),
    },
    "1m": {
      logStartDate: "09 AUG 2026",
      rawMetrics: {
        totalMs: 416400000,
        trackCount: 375,
        artistCount: 92,
        elapsedDays: 30,
      },
      metrics: ["6,940", "375", "92", "3.8h"],
      topTracks: TOP_TRACKS_1M,
      topArtists: [
        { rank: "01", name: "Radiohead", id: "4Z8W4fKeB5YxbusRsdQVPb", count: 156 },
        { rank: "02", name: "Frank Ocean", id: "2h93pZq0e7k5yf4Y40u9UR", count: 148 },
        { rank: "03", name: "Kendrick Lamar", id: "2YZyLoL8N0Wb9xBt1NhZWg", count: 124 },
        { rank: "04", name: "Pink Floyd", id: "0k17h0D3J5VfsdmQ1iZtE9", count: 108 },
        { rank: "05", name: "Phoebe Bridgers", id: "1r1uxoy19fzMxunt3ONAkG", count: 96 },
      ],
      topAlbums: [
        { rank: "01", name: "In Rainbows", artist: "Radiohead", id: "7vd91cWv27mKrnG67vR4iR", artistId: "4Z8W4fKeB5YxbusRsdQVPb", count: 94 },
        { rank: "02", name: "Blonde", artist: "Frank Ocean", id: "3mH6qwIy9crq0I9YQbOuDf", artistId: "2h93pZq0e7k5yf4Y40u9UR", count: 88 },
        { rank: "03", name: "The Dark Side of the Moon", artist: "Pink Floyd", id: "4LH4d3cOWNNXdsqFd42wzg", artistId: "0k17h0D3J5VfsdmQ1iZtE9", count: 72 },
        { rank: "04", name: "To Pimp a Butterfly", artist: "Kendrick Lamar", id: "7ycBtnsMtyVbbw3fMwR2nM", artistId: "2YZyLoL8N0Wb9xBt1NhZWg", count: 68 },
        { rank: "05", name: "Punisher", artist: "Phoebe Bridgers", id: "2xGQEAlDAw7whm4vvt3WvX", artistId: "1r1uxoy19fzMxunt3ONAkG", count: 58 },
      ],
      activityCadence: Array.from({ length: 30 }, (_, i) => {
        const day = i + 10;
        const dStr = day <= 31 ? `${day} AUG` : `${day - 31} SEP`;
        const isMarker = i === 0 || i === 7 || i === 14 || i === 21 || i === 29;
        const monthIndex = day <= 31 ? 7 : 8; // 7 = Aug, 8 = Sep
        const calendarDay = day <= 31 ? day : day - 31;
        return {
          date: dStr,
          startTime: new Date(Date.UTC(2026, monthIndex, calendarDay, 0, 0, 0, 0)).toISOString(),
          endTime: new Date(Date.UTC(2026, monthIndex, calendarDay, 23, 59, 59, 999)).toISOString(),
          count: 14 + Math.round(Math.sin(i * 0.45) * 12 + (i % 4) * 6),
          isMarker,
          markerLabel: isMarker ? dStr : undefined,
        };
      }),
    },
    "6m": {
      logStartDate: "09 MAR 2026",
      rawMetrics: {
        totalMs: 2526000000,
        trackCount: 1890,
        artistCount: 320,
        elapsedDays: 180,
      },
      metrics: ["42,100", "1,890", "320", "3.9h"],
      topTracks: TOP_TRACKS_6M,
      topArtists: [
        { rank: "01", name: "Radiohead", id: "4Z8W4fKeB5YxbusRsdQVPb", count: 1240 },
        { rank: "02", name: "Frank Ocean", id: "2h93pZq0e7k5yf4Y40u9UR", count: 1120 },
        { rank: "03", name: "Kendrick Lamar", id: "2YZyLoL8N0Wb9xBt1NhZWg", count: 860 },
        { rank: "04", name: "Pink Floyd", id: "0k17h0D3J5VfsdmQ1iZtE9", count: 780 },
        { rank: "05", name: "Tame Impala", id: "5INjqkS1o8h1imAzPqGZBb", count: 690 },
      ],
      topAlbums: [
        { rank: "01", name: "In Rainbows", artist: "Radiohead", id: "7vd91cWv27mKrnG67vR4iR", artistId: "4Z8W4fKeB5YxbusRsdQVPb", count: 620 },
        { rank: "02", name: "Blonde", artist: "Frank Ocean", id: "3mH6qwIy9crq0I9YQbOuDf", artistId: "2h93pZq0e7k5yf4Y40u9UR", count: 580 },
        { rank: "03", name: "The Dark Side of the Moon", artist: "Pink Floyd", id: "4LH4d3cOWNNXdsqFd42wzg", artistId: "0k17h0D3J5VfsdmQ1iZtE9", count: 480 },
        { rank: "04", name: "To Pimp a Butterfly", artist: "Kendrick Lamar", id: "7ycBtnsMtyVbbw3fMwR2nM", artistId: "2YZyLoL8N0Wb9xBt1NhZWg", count: 420 },
        { rank: "05", name: "Currents", artist: "Tame Impala", id: "79dL7FLiJFOO0EoehTaA1m", artistId: "5INjqkS1o8h1imAzPqGZBb", count: 390 },
      ],
      activityCadence: (() => {
        const base = new Date(Date.UTC(2026, 8, 9, 0, 0, 0, 0));
        let lastMonth = "";
        return Array.from({ length: 26 }, (_, i) => {
          const weekEnd = new Date(base.getTime() - (25 - i) * 7 * 86400000);
          weekEnd.setUTCHours(23, 59, 59, 999);
          const weekStart = new Date(weekEnd.getTime() - 7 * 86400000 + 1);
          weekStart.setUTCHours(0, 0, 0, 0);

          const monthAbbr = new Intl.DateTimeFormat("en-US", {
            timeZone: "UTC",
            month: "short",
          }).format(weekStart).toUpperCase();

          const isNewMonth = monthAbbr !== lastMonth;
          if (isNewMonth) lastMonth = monthAbbr;

          return {
            date: `W${i + 1}`,
            startTime: weekStart.toISOString(),
            endTime: weekEnd.toISOString(),
            count: 85 + Math.round(Math.sin(i * 0.38) * 38 + (i % 3) * 14),
            isMarker: isNewMonth,
            markerLabel: isNewMonth ? monthAbbr : undefined,
          };
        });
      })(),
    },
    "1y": {
      logStartDate: "09 SEP 2025",
      rawMetrics: {
        totalMs: 6912000000,
        trackCount: 4250,
        artistCount: 740,
        elapsedDays: 365,
      },
      metrics: ["115,200", "4,250", "740", "3.7h"],
      topTracks: TOP_TRACKS_1Y,
      topArtists: [
        { rank: "01", name: "Radiohead", id: "4Z8W4fKeB5YxbusRsdQVPb", count: 3520 },
        { rank: "02", name: "Frank Ocean", id: "2h93pZq0e7k5yf4Y40u9UR", count: 2980 },
        { rank: "03", name: "Pink Floyd", id: "0k17h0D3J5VfsdmQ1iZtE9", count: 2420 },
        { rank: "04", name: "Kendrick Lamar", id: "2YZyLoL8N0Wb9xBt1NhZWg", count: 2190 },
        { rank: "05", name: "The Beatles", id: "3WrFJ7ztbogyGnTHbHJFl2", count: 1840 },
      ],
      topAlbums: [
        { rank: "01", name: "In Rainbows", artist: "Radiohead", id: "7vd91cWv27mKrnG67vR4iR", artistId: "4Z8W4fKeB5YxbusRsdQVPb", count: 1780 },
        { rank: "02", name: "Blonde", artist: "Frank Ocean", id: "3mH6qwIy9crq0I9YQbOuDf", artistId: "2h93pZq0e7k5yf4Y40u9UR", count: 1520 },
        { rank: "03", name: "The Dark Side of the Moon", artist: "Pink Floyd", id: "4LH4d3cOWNNXdsqFd42wzg", artistId: "0k17h0D3J5VfsdmQ1iZtE9", count: 1260 },
        { rank: "04", name: "To Pimp a Butterfly", artist: "Kendrick Lamar", id: "7ycBtnsMtyVbbw3fMwR2nM", artistId: "2YZyLoL8N0Wb9xBt1NhZWg", count: 1140 },
        { rank: "05", name: "Abbey Road", artist: "The Beatles", id: "0ETFjACtuP2ADo6LFhL6HN", artistId: "3WrFJ7ztbogyGnTHbHJFl2", count: 960 },
      ],
      activityCadence: [
        { month: 9, year: 2025, name: "OCT" },
        { month: 10, year: 2025, name: "NOV" },
        { month: 11, year: 2025, name: "DEC" },
        { month: 0, year: 2026, name: "JAN" },
        { month: 1, year: 2026, name: "FEB" },
        { month: 2, year: 2026, name: "MAR" },
        { month: 3, year: 2026, name: "APR" },
        { month: 4, year: 2026, name: "MAY" },
        { month: 5, year: 2026, name: "JUN" },
        { month: 6, year: 2026, name: "JUL" },
        { month: 7, year: 2026, name: "AUG" },
        { month: 8, year: 2026, name: "SEP" },
      ].map((item, i) => ({
        date: item.name,
        startTime: new Date(Date.UTC(item.year, item.month, 1, 0, 0, 0, 0)).toISOString(),
        endTime: new Date(Date.UTC(item.year, item.month + 1, 0, 23, 59, 59, 999)).toISOString(),
        count: 95 + Math.round(Math.sin(i * 0.48) * 36 + (i % 4) * 12),
      })),
    },
    all: {
      logStartDate: "14 AUG 2024",
      rawMetrics: {
        totalMs: 13104000000,
        trackCount: 8620,
        artistCount: 1310,
        elapsedDays: 1040,
      },
      metrics: ["218,400", "8,620", "1,310", "3.5h"],
      topTracks: TOP_TRACKS_ALL,
      topArtists: [
        { rank: "01", name: "Radiohead", id: "4Z8W4fKeB5YxbusRsdQVPb", count: 6940 },
        { rank: "02", name: "Frank Ocean", id: "2h93pZq0e7k5yf4Y40u9UR", count: 6020 },
        { rank: "03", name: "Pink Floyd", id: "0k17h0D3J5VfsdmQ1iZtE9", count: 4890 },
        { rank: "04", name: "Kendrick Lamar", id: "2YZyLoL8N0Wb9xBt1NhZWg", count: 4420 },
        { rank: "05", name: "The Beatles", id: "3WrFJ7ztbogyGnTHbHJFl2", count: 3780 },
      ],
      topAlbums: [
        { rank: "01", name: "In Rainbows", artist: "Radiohead", id: "7vd91cWv27mKrnG67vR4iR", artistId: "4Z8W4fKeB5YxbusRsdQVPb", count: 3510 },
        { rank: "02", name: "Blonde", artist: "Frank Ocean", id: "3mH6qwIy9crq0I9YQbOuDf", artistId: "2h93pZq0e7k5yf4Y40u9UR", count: 2940 },
        { rank: "03", name: "The Dark Side of the Moon", artist: "Pink Floyd", id: "4LH4d3cOWNNXdsqFd42wzg", artistId: "0k17h0D3J5VfsdmQ1iZtE9", count: 2480 },
        { rank: "04", name: "To Pimp a Butterfly", artist: "Kendrick Lamar", id: "7ycBtnsMtyVbbw3fMwR2nM", artistId: "2YZyLoL8N0Wb9xBt1NhZWg", count: 2210 },
        { rank: "05", name: "Abbey Road", artist: "The Beatles", id: "0ETFjACtuP2ADo6LFhL6HN", artistId: "3WrFJ7ztbogyGnTHbHJFl2", count: 1860 },
      ],
      activityCadence: [2024, 2025, 2026].map((yr, i) => ({
        date: String(yr),
        startTime: new Date(Date.UTC(yr, 0, 1, 0, 0, 0, 0)).toISOString(),
        endTime: new Date(Date.UTC(yr, 11, 31, 23, 59, 59, 999)).toISOString(),
        count: [54200, 98400, 65800][i],
      })),
    },
  },

  // -------------------------------------------------------------------------
  // Mode 1: Stream Log (50 Plays, Day Groups, Session Gaps)
  // -------------------------------------------------------------------------
  streamLog: {
  "rawMetrics": {
    "totalPlays": 150,
    "uniqueTracks": 84,
    "uniqueArtists": 34,
    "streakDays": 14
  },
  "metrics": [
    "150",
    "84",
    "34",
    "14 DAYS"
  ],
  "hasMore": true,
  "nextCursor": "2026-09-07T18:54:00.000Z",
  "nextCursorId": "sl-50",
  "entries": [
    {
      "id": "sl-1",
      "title": "Weird Fishes / Arpeggi",
      "artist": "Radiohead",
      "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
      "album": "In Rainbows",
      "albumId": "7vd91cWv27mKrnG67vR4iR",
      "durationMs": 318000,
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
      "playedAt": "2026-09-09T23:44:00.000Z"
    },
    {
      "id": "sl-2",
      "title": "15 Step",
      "artist": "Radiohead",
      "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
      "album": "In Rainbows",
      "albumId": "7vd91cWv27mKrnG67vR4iR",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
      "playedAt": "2026-09-09T23:38:00.000Z",
      "durationMs": 237000
    },
    {
      "id": "sl-3",
      "title": "Pink + White",
      "artist": "Frank Ocean",
      "artistId": "2h93pZq0e7k5yf4Y40u9UR",
      "album": "Blonde",
      "albumId": "3mH6qwIy9crq0I9YQbOuDf",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T23:34:00.000Z",
      "durationMs": 184000
    },
    {
      "id": "sl-4",
      "title": "Ivy",
      "artist": "Frank Ocean",
      "artistId": "2h93pZq0e7k5yf4Y40u9UR",
      "album": "Blonde",
      "albumId": "3mH6qwIy9crq0I9YQbOuDf",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T23:29:00.000Z",
      "durationMs": 249000
    },
    {
      "id": "sl-5",
      "title": "Alright",
      "artist": "Kendrick Lamar",
      "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
      "album": "To Pimp a Butterfly",
      "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T23:24:00.000Z",
      "durationMs": 219000
    },
    {
      "id": "sl-6",
      "title": "Kyoto",
      "artist": "Phoebe Bridgers",
      "artistId": "1r1uxoy19fzMxunt3ONAkG",
      "album": "Punisher",
      "albumId": "2xGQEAlDAw7whm4vvt3WvX",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T23:20:00.000Z",
      "durationMs": 184000
    },
    {
      "id": "sl-7",
      "title": "I Know The End",
      "artist": "Phoebe Bridgers",
      "artistId": "1r1uxoy19fzMxunt3ONAkG",
      "album": "Punisher",
      "albumId": "2xGQEAlDAw7whm4vvt3WvX",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T23:14:00.000Z",
      "durationMs": 344000
    },
    {
      "id": "sl-8",
      "title": "Dreams",
      "artist": "Fleetwood Mac",
      "artistId": "08GQAI4e5rBaRujQwE7AVn",
      "album": "Rumours",
      "albumId": "1BZhsjlBYzDbKyJdYBMxev",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T23:09:00.000Z",
      "durationMs": 257000
    },
    {
      "id": "sl-9",
      "title": "The Chain",
      "artist": "Fleetwood Mac",
      "artistId": "08GQAI4e5rBaRujQwE7AVn",
      "album": "Rumours",
      "albumId": "1BZhsjlBYzDbKyJdYBMxev",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T23:04:00.000Z",
      "durationMs": 270000
    },
    {
      "id": "sl-10",
      "title": "Time",
      "artist": "Pink Floyd",
      "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
      "album": "The Dark Side of the Moon",
      "albumId": "4LH4d3cOWNNXdsqFd42wzg",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:58:00.000Z",
      "durationMs": 413000
    },
    {
      "id": "sl-11",
      "title": "Money",
      "artist": "Pink Floyd",
      "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
      "album": "The Dark Side of the Moon",
      "albumId": "4LH4d3cOWNNXdsqFd42wzg",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:51:00.000Z",
      "durationMs": 382000
    },
    {
      "id": "sl-12",
      "title": "Get Lucky",
      "artist": "Daft Punk",
      "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
      "album": "Random Access Memories",
      "albumId": "4m2880jivSbbyEGAKfITCa",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:45:00.000Z",
      "durationMs": 369000
    },
    {
      "id": "sl-13",
      "title": "Instant Crush",
      "artist": "Daft Punk",
      "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
      "album": "Random Access Memories",
      "albumId": "4m2880jivSbbyEGAKfITCa",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:39:00.000Z",
      "durationMs": 337000
    },
    {
      "id": "sl-14",
      "title": "Come Together",
      "artist": "The Beatles",
      "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
      "album": "Abbey Road",
      "albumId": "0ETFjACtuP2ADo6LFhL6HN",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:35:00.000Z",
      "durationMs": 259000
    },
    {
      "id": "sl-15",
      "title": "Here Comes The Sun",
      "artist": "The Beatles",
      "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
      "album": "Abbey Road",
      "albumId": "0ETFjACtuP2ADo6LFhL6HN",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:31:00.000Z",
      "durationMs": 185000
    },
    {
      "id": "sl-16",
      "title": "cardigan",
      "artist": "Taylor Swift",
      "artistId": "06HL4z0CvFAxyc27GXpf02",
      "album": "folklore",
      "albumId": "2fenSS68JI1h4Fo296JfGr",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:27:00.000Z",
      "durationMs": 239000
    },
    {
      "id": "sl-17",
      "title": "exile (feat. Bon Iver)",
      "artist": "Taylor Swift",
      "artistId": "06HL4z0CvFAxyc27GXpf02",
      "album": "folklore",
      "albumId": "2fenSS68JI1h4Fo296JfGr",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:22:00.000Z",
      "durationMs": 285000
    },
    {
      "id": "sl-18",
      "title": "bad guy",
      "artist": "Billie Eilish",
      "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
      "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
      "albumId": "0S0KGZnfBGSI3F0irHgAC0",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T22:18:00.000Z",
      "durationMs": 194000
    },
    {
      "id": "sl-19",
      "title": "Do I Wanna Know?",
      "artist": "Arctic Monkeys",
      "artistId": "7Ln80lUS6He07XvHI8qqHH",
      "album": "AM",
      "albumId": "78bpIziExqiI91ztvVJ5nR",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
      "playedAt": "2026-09-09T17:42:00.000Z",
      "durationMs": 272000,
      "sessionGap": {
        "durationMs": 16560000,
        "sessionId": "sl-22",
        "trackCount": 4,
        "runtimeMs": 1275000
      }
    },
    {
      "id": "sl-20",
      "title": "Space Song",
      "artist": "Beach House",
      "artistId": "56ZTgzPBDge0OvCGgMO3OY",
      "album": "Depression Cherry",
      "albumId": "7vK5a287L67hEw6pWbQvL8",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T17:37:00.000Z",
      "durationMs": 320000
    },
    {
      "id": "sl-21",
      "title": "The Less I Know The Better",
      "artist": "Tame Impala",
      "artistId": "5INjqkS1o8h1imAzPqGZBb",
      "album": "Currents",
      "albumId": "79dL7FLiJFOO0EoehTaA1m",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-09T17:31:00.000Z",
      "durationMs": 216000
    },
    {
      "id": "sl-22",
      "title": "Nude",
      "artist": "Radiohead",
      "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
      "album": "In Rainbows",
      "albumId": "7vd91cWv27mKrnG67vR4iR",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
      "playedAt": "2026-09-09T17:25:00.000Z",
      "durationMs": 255000
    },
    {
      "id": "sl-23",
      "title": "Smells Like Teen Spirit",
      "artist": "Nirvana",
      "artistId": "6olE6TJLqED3rqDCT0FyPh",
      "album": "Nevermind",
      "albumId": "2guIrUQVRq0VmsvBpJR297",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T21:50:00.000Z",
      "durationMs": 301000,
      "sessionGap": {
        "durationMs": 70500000,
        "sessionId": "sl-40",
        "trackCount": 18,
        "runtimeMs": 5959000
      }
    },
    {
      "id": "sl-24",
      "title": "\"Heroes\"",
      "artist": "David Bowie",
      "artistId": "0oSGxfWSnnOXhD2fKuz2Gy",
      "album": "\"Heroes\"",
      "albumId": "4I5zzKY1sp4neTeiU0W2Vw",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T21:44:00.000Z",
      "durationMs": 371000
    },
    {
      "id": "sl-25",
      "title": "Billie Jean",
      "artist": "Michael Jackson",
      "artistId": "3fMbdgg4jU18AjLCKBvRSm",
      "album": "Thriller",
      "albumId": "2noRn2Aes5aoQ6vUvt4mhu",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T21:38:00.000Z",
      "durationMs": 294000
    },
    {
      "id": "sl-26",
      "title": "Bohemian Rhapsody",
      "artist": "Queen",
      "artistId": "1dfeR4HaWDbWqFssioeoL2",
      "album": "A Night at the Opera",
      "albumId": "1GbtB4zTqAsyfZEsm1RZSZ",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T21:32:00.000Z",
      "durationMs": 354000
    },
    {
      "id": "sl-27",
      "title": "Ribs",
      "artist": "Lorde",
      "artistId": "163tK9Wjr9P9DmM0AVK7lm",
      "album": "Pure Heroine",
      "albumId": "0rmhj0uqT3lP906w3C0123",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T21:26:00.000Z",
      "durationMs": 258000
    },
    {
      "id": "sl-28",
      "title": "God Only Knows",
      "artist": "The Beach Boys",
      "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
      "album": "Pet Sounds",
      "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T21:21:00.000Z",
      "durationMs": 173000
    },
    {
      "id": "sl-29",
      "title": "Stairway to Heaven",
      "artist": "Led Zeppelin",
      "artistId": "36QJfgBno56YwhRGFKX9Cr",
      "album": "Led Zeppelin IV",
      "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T21:13:00.000Z",
      "durationMs": 482000
    },
    {
      "id": "sl-30",
      "title": "Paranoid Android",
      "artist": "Radiohead",
      "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
      "album": "OK Computer",
      "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
      "playedAt": "2026-09-08T21:07:00.000Z",
      "durationMs": 383000
    },
    {
      "id": "sl-31",
      "title": "Karma Police",
      "artist": "Radiohead",
      "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
      "album": "OK Computer",
      "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
      "playedAt": "2026-09-08T21:02:00.000Z",
      "durationMs": 261000
    },
    {
      "id": "sl-32",
      "title": "Nikes",
      "artist": "Frank Ocean",
      "artistId": "2h93pZq0e7k5yf4Y40u9UR",
      "album": "Blonde",
      "albumId": "3mH6qwIy9crq0I9YQbOuDf",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:56:00.000Z",
      "durationMs": 314000
    },
    {
      "id": "sl-33",
      "title": "Nights",
      "artist": "Frank Ocean",
      "artistId": "2h93pZq0e7k5yf4Y40u9UR",
      "album": "Blonde",
      "albumId": "3mH6qwIy9crq0I9YQbOuDf",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:51:00.000Z",
      "durationMs": 307000
    },
    {
      "id": "sl-34",
      "title": "King Kunta",
      "artist": "Kendrick Lamar",
      "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
      "album": "To Pimp a Butterfly",
      "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:47:00.000Z",
      "durationMs": 234000
    },
    {
      "id": "sl-35",
      "title": "Money Trees",
      "artist": "Kendrick Lamar",
      "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
      "album": "good kid, m.A.A.d city",
      "albumId": "748dEZwhgnyspuaWIvlyx9",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:41:00.000Z",
      "durationMs": 386000
    },
    {
      "id": "sl-36",
      "title": "Motion Sickness",
      "artist": "Phoebe Bridgers",
      "artistId": "1r1uxoy19fzMxunt3ONAkG",
      "album": "Stranger in the Alps",
      "albumId": "0AkFsgr2q1t75h8aV6uLpC",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:37:00.000Z",
      "durationMs": 229000
    },
    {
      "id": "sl-37",
      "title": "Dreams",
      "artist": "Fleetwood Mac",
      "artistId": "08GQAI4e5rBaRujQwE7AVn",
      "album": "Rumours",
      "albumId": "1BZhsjlBYzDbKyJdYBMxev",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:31:00.000Z",
      "durationMs": 257000
    },
    {
      "id": "sl-38",
      "title": "Time",
      "artist": "Pink Floyd",
      "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
      "album": "The Dark Side of the Moon",
      "albumId": "4LH4d3cOWNNXdsqFd42wzg",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:25:00.000Z",
      "durationMs": 413000
    },
    {
      "id": "sl-39",
      "title": "Get Lucky",
      "artist": "Daft Punk",
      "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
      "album": "Random Access Memories",
      "albumId": "4m2880jivSbbyEGAKfITCa",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:19:00.000Z",
      "durationMs": 369000
    },
    {
      "id": "sl-40",
      "title": "Come Together",
      "artist": "The Beatles",
      "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
      "album": "Abbey Road",
      "albumId": "0ETFjACtuP2ADo6LFhL6HN",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-08T20:15:00.000Z",
      "durationMs": 259000
    },
    {
      "id": "sl-41",
      "title": "Weird Fishes / Arpeggi",
      "artist": "Radiohead",
      "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
      "album": "In Rainbows",
      "albumId": "7vd91cWv27mKrnG67vR4iR",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
      "playedAt": "2026-09-07T19:40:00.000Z",
      "durationMs": 318000,
      "sessionGap": {
        "durationMs": 88500000,
        "sessionId": "sl-50",
        "trackCount": 10,
        "runtimeMs": 2945000
      }
    },
    {
      "id": "sl-42",
      "title": "Reckoner",
      "artist": "Radiohead",
      "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
      "album": "In Rainbows",
      "albumId": "7vd91cWv27mKrnG67vR4iR",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
      "playedAt": "2026-09-07T19:35:00.000Z",
      "durationMs": 290000
    },
    {
      "id": "sl-43",
      "title": "Pink + White",
      "artist": "Frank Ocean",
      "artistId": "2h93pZq0e7k5yf4Y40u9UR",
      "album": "Blonde",
      "albumId": "3mH6qwIy9crq0I9YQbOuDf",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T19:30:00.000Z",
      "durationMs": 184000
    },
    {
      "id": "sl-44",
      "title": "Ivy",
      "artist": "Frank Ocean",
      "artistId": "2h93pZq0e7k5yf4Y40u9UR",
      "album": "Blonde",
      "albumId": "3mH6qwIy9crq0I9YQbOuDf",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T19:26:00.000Z",
      "durationMs": 249000
    },
    {
      "id": "sl-45",
      "title": "Alright",
      "artist": "Kendrick Lamar",
      "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
      "album": "To Pimp a Butterfly",
      "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T19:21:00.000Z",
      "durationMs": 219000
    },
    {
      "id": "sl-46",
      "title": "Kyoto",
      "artist": "Phoebe Bridgers",
      "artistId": "1r1uxoy19fzMxunt3ONAkG",
      "album": "Punisher",
      "albumId": "2xGQEAlDAw7whm4vvt3WvX",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T19:17:00.000Z",
      "durationMs": 184000
    },
    {
      "id": "sl-47",
      "title": "The Chain",
      "artist": "Fleetwood Mac",
      "artistId": "08GQAI4e5rBaRujQwE7AVn",
      "album": "Rumours",
      "albumId": "1BZhsjlBYzDbKyJdYBMxev",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T19:11:00.000Z",
      "durationMs": 270000
    },
    {
      "id": "sl-48",
      "title": "Time",
      "artist": "Pink Floyd",
      "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
      "album": "The Dark Side of the Moon",
      "albumId": "4LH4d3cOWNNXdsqFd42wzg",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T19:04:00.000Z",
      "durationMs": 413000
    },
    {
      "id": "sl-49",
      "title": "Get Lucky",
      "artist": "Daft Punk",
      "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
      "album": "Random Access Memories",
      "albumId": "4m2880jivSbbyEGAKfITCa",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T18:58:00.000Z",
      "durationMs": 369000
    },
    {
      "id": "sl-50",
      "title": "Here Comes The Sun",
      "artist": "The Beatles",
      "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
      "album": "Abbey Road",
      "albumId": "0ETFjACtuP2ADo6LFhL6HN",
      "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
      "playedAt": "2026-09-07T18:54:00.000Z",
      "durationMs": 185000
    }
  ]
},

  // -------------------------------------------------------------------------
  // Mode 2: Session View (20 Previous Sessions, Active Session, Full Sessions)
  // -------------------------------------------------------------------------
  session: {
  "sessions": [
    {
      "id": "mock-s1-17",
      "startedAt": "2026-09-09T22:18:00.000Z",
      "endedAt": "2026-09-09T23:28:00.000Z",
      "runtimeMs": 4921000,
      "trackCount": 18,
      "uniqueArtistsCount": 5,
      "isOpen": false,
      "tracks": [
        {
          "id": "5e9TFT0nj3YegNVJE4uus4",
          "title": "The Chain",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s1-0",
          "playedAt": "2026-09-09T23:28:00.000Z",
          "durationMs": 270000
        },
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-1",
          "playedAt": "2026-09-09T23:24:00.000Z",
          "durationMs": 257000
        },
        {
          "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
          "title": "I Know The End",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-2",
          "playedAt": "2026-09-09T23:20:00.000Z",
          "durationMs": 344000
        },
        {
          "id": "5xo8RrjJ9CVNrtRg2S3tyW",
          "title": "Motion Sickness",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Stranger in the Alps",
          "albumId": "0AkFsgr2q1t75h8aV6uLpC",
          "swatchColor": "#282A32",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-3",
          "playedAt": "2026-09-09T23:16:00.000Z",
          "durationMs": 229000
        },
        {
          "id": "49UDv3b5B1bQx4K43Q486h",
          "title": "Kyoto",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s1-4",
          "playedAt": "2026-09-09T23:11:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "74tLlkN3pmQwBvaMRA4oxE",
          "title": "Money Trees",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "good kid, m.A.A.d city",
          "albumId": "748dEZwhgnyspuaWIvlyx9",
          "swatchColor": "#3D352E",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-5",
          "playedAt": "2026-09-09T23:07:00.000Z",
          "durationMs": 386000
        },
        {
          "id": "0N3W5qLeLqETRpyPheLGR5",
          "title": "King Kunta",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-6",
          "playedAt": "2026-09-09T23:03:00.000Z",
          "durationMs": 234000
        },
        {
          "id": "3iVcQ50DCVupKAh0DxnZ1z",
          "title": "Alright",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-7",
          "playedAt": "2026-09-09T22:59:00.000Z",
          "durationMs": 219000
        },
        {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s1-8",
          "playedAt": "2026-09-09T22:55:00.000Z",
          "durationMs": 307000
        },
        {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-9",
          "playedAt": "2026-09-09T22:51:00.000Z",
          "durationMs": 249000
        },
        {
          "id": "19YKaevk2bce41UVk7RAum",
          "title": "Nikes",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-10",
          "playedAt": "2026-09-09T22:47:00.000Z",
          "durationMs": 314000
        },
        {
          "id": "3xKsf9qdS1CyvXS5sb08b8",
          "title": "Pink + White",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-11",
          "playedAt": "2026-09-09T22:43:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "63OQupATfueENZJaC0gNm1",
          "title": "Karma Police",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s1-12",
          "playedAt": "2026-09-09T22:39:00.000Z",
          "durationMs": 261000
        },
        {
          "id": "6LgJvl0Xdtc73RJ1mmpotq",
          "title": "Paranoid Android",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-13",
          "playedAt": "2026-09-09T22:34:00.000Z",
          "durationMs": 383000
        },
        {
          "id": "3zXh2r4hL4QhZ6qV6s0V8r",
          "title": "Reckoner",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-14",
          "playedAt": "2026-09-09T22:30:00.000Z",
          "durationMs": 290000
        },
        {
          "id": "35YyxFtlUBloXIwtav7Ch5",
          "title": "Nude",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-15",
          "playedAt": "2026-09-09T22:26:00.000Z",
          "durationMs": 255000
        },
        {
          "id": "4I2JA4Z53b01a14oH4pD2t",
          "title": "15 Step",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s1-16",
          "playedAt": "2026-09-09T22:22:00.000Z",
          "durationMs": 237000
        },
        {
          "id": "4clD00s1c0rVqP9Ld0vV48",
          "title": "Weird Fishes / Arpeggi",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s1-17",
          "playedAt": "2026-09-09T22:18:00.000Z",
          "durationMs": 318000
        }
      ],
      "analysis": {
        "firstPlaysCount": 5,
        "totalTracks": 18,
        "topTrack": {
          "id": "5e9TFT0nj3YegNVJE4uus4",
          "title": "The Chain",
          "artist": "Fleetwood Mac",
          "count": 1
        },
        "topAlbum": {
          "id": "3mH6qwIy9crq0I9YQbOuDf",
          "title": "Blonde",
          "artist": "Frank Ocean",
          "count": 4
        },
        "topArtist": {
          "id": "4Z8W4fKeB5YxbusRsdQVPb",
          "name": "Radiohead",
          "count": 6
        }
      }
    },
    {
      "id": "mock-s2-3",
      "startedAt": "2026-09-09T17:25:00.000Z",
      "endedAt": "2026-09-09T17:46:00.000Z",
      "runtimeMs": 1521000,
      "trackCount": 4,
      "uniqueArtistsCount": 2,
      "isOpen": false,
      "tracks": [
        {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s2-0",
          "playedAt": "2026-09-09T17:46:00.000Z",
          "durationMs": 249000
        },
        {
          "id": "19YKaevk2bce41UVk7RAum",
          "title": "Nikes",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s2-1",
          "playedAt": "2026-09-09T17:39:00.000Z",
          "durationMs": 314000
        },
        {
          "id": "3xKsf9qdS1CyvXS5sb08b8",
          "title": "Pink + White",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s2-2",
          "playedAt": "2026-09-09T17:32:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "63OQupATfueENZJaC0gNm1",
          "title": "Karma Police",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s2-3",
          "playedAt": "2026-09-09T17:25:00.000Z",
          "durationMs": 261000
        }
      ],
      "analysis": {
        "firstPlaysCount": 1,
        "totalTracks": 4,
        "topTrack": {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "count": 1
        },
        "topAlbum": {
          "id": "3mH6qwIy9crq0I9YQbOuDf",
          "title": "Blonde",
          "artist": "Frank Ocean",
          "count": 3
        },
        "topArtist": {
          "id": "2h93pZq0e7k5yf4Y40u9UR",
          "name": "Frank Ocean",
          "count": 3
        }
      }
    },
    {
      "id": "mock-s3-17",
      "startedAt": "2026-09-08T20:15:00.000Z",
      "endedAt": "2026-09-08T21:32:00.000Z",
      "runtimeMs": 5058000,
      "trackCount": 18,
      "uniqueArtistsCount": 9,
      "isOpen": false,
      "tracks": [
        {
          "id": "5FVbvFqU2sU5r0fI2b8Q7B",
          "title": "Do I Wanna Know?",
          "artist": "Arctic Monkeys",
          "artistId": "7Ln80lUS6He07XvHI8qqHH",
          "album": "AM",
          "albumId": "78bpIziExqiI91ztvVJ5nR",
          "swatchColor": "#1A1A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-0",
          "playedAt": "2026-09-08T21:32:00.000Z",
          "durationMs": 272000
        },
        {
          "id": "2Fxmhks0bxGSBdJ92v442m",
          "title": "bad guy",
          "artist": "Billie Eilish",
          "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
          "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
          "albumId": "0S0KGZnfBGSI3F0irHgAC0",
          "swatchColor": "#303028",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-1",
          "playedAt": "2026-09-08T21:28:00.000Z",
          "durationMs": 194000
        },
        {
          "id": "4pvb0WLRcMtbPGm22F8N0P",
          "title": "exile (feat. Bon Iver)",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s3-2",
          "playedAt": "2026-09-08T21:23:00.000Z",
          "durationMs": 285000
        },
        {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-3",
          "playedAt": "2026-09-08T21:19:00.000Z",
          "durationMs": 239000
        },
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-4",
          "playedAt": "2026-09-08T21:14:00.000Z",
          "durationMs": 185000
        },
        {
          "id": "2EqlS6tkEnglzr77vAhx2b",
          "title": "Come Together",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-5",
          "playedAt": "2026-09-08T21:10:00.000Z",
          "durationMs": 259000
        },
        {
          "id": "2cGxRwrMygjFu8KiMF1PFR",
          "title": "Instant Crush",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s3-6",
          "playedAt": "2026-09-08T21:05:00.000Z",
          "durationMs": 337000
        },
        {
          "id": "2Foc5Q5nqNiosCNqttzHof",
          "title": "Get Lucky",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-7",
          "playedAt": "2026-09-08T21:01:00.000Z",
          "durationMs": 369000
        },
        {
          "id": "0vFOzaXqCYFJvnudGii36Q",
          "title": "Money",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-8",
          "playedAt": "2026-09-08T20:56:00.000Z",
          "durationMs": 382000
        },
        {
          "id": "3TO7mKlbtik89FRIYod0Ij",
          "title": "Time",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-9",
          "playedAt": "2026-09-08T20:51:00.000Z",
          "durationMs": 413000
        },
        {
          "id": "5e9TFT0nj3YegNVJE4uus4",
          "title": "The Chain",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s3-10",
          "playedAt": "2026-09-08T20:47:00.000Z",
          "durationMs": 270000
        },
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-11",
          "playedAt": "2026-09-08T20:42:00.000Z",
          "durationMs": 257000
        },
        {
          "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
          "title": "I Know The End",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-12",
          "playedAt": "2026-09-08T20:38:00.000Z",
          "durationMs": 344000
        },
        {
          "id": "5xo8RrjJ9CVNrtRg2S3tyW",
          "title": "Motion Sickness",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Stranger in the Alps",
          "albumId": "0AkFsgr2q1t75h8aV6uLpC",
          "swatchColor": "#282A32",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-13",
          "playedAt": "2026-09-08T20:33:00.000Z",
          "durationMs": 229000
        },
        {
          "id": "49UDv3b5B1bQx4K43Q486h",
          "title": "Kyoto",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s3-14",
          "playedAt": "2026-09-08T20:29:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "74tLlkN3pmQwBvaMRA4oxE",
          "title": "Money Trees",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "good kid, m.A.A.d city",
          "albumId": "748dEZwhgnyspuaWIvlyx9",
          "swatchColor": "#3D352E",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-15",
          "playedAt": "2026-09-08T20:24:00.000Z",
          "durationMs": 386000
        },
        {
          "id": "0N3W5qLeLqETRpyPheLGR5",
          "title": "King Kunta",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-16",
          "playedAt": "2026-09-08T20:20:00.000Z",
          "durationMs": 234000
        },
        {
          "id": "3iVcQ50DCVupKAh0DxnZ1z",
          "title": "Alright",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s3-17",
          "playedAt": "2026-09-08T20:15:00.000Z",
          "durationMs": 219000
        }
      ],
      "analysis": {
        "firstPlaysCount": 4,
        "totalTracks": 18,
        "topTrack": {
          "id": "5FVbvFqU2sU5r0fI2b8Q7B",
          "title": "Do I Wanna Know?",
          "artist": "Arctic Monkeys",
          "count": 1
        },
        "topAlbum": {
          "id": "2fenSS68JI1h4Fo296JfGr",
          "title": "folklore",
          "artist": "Taylor Swift",
          "count": 2
        },
        "topArtist": {
          "id": "1r1uxoy19fzMxunt3ONAkG",
          "name": "Phoebe Bridgers",
          "count": 3
        }
      }
    },
    {
      "id": "mock-s4-9",
      "startedAt": "2026-09-07T18:54:00.000Z",
      "endedAt": "2026-09-07T19:35:00.000Z",
      "runtimeMs": 3055000,
      "trackCount": 10,
      "uniqueArtistsCount": 6,
      "isOpen": false,
      "tracks": [
        {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-0",
          "playedAt": "2026-09-07T19:35:00.000Z",
          "durationMs": 239000
        },
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-1",
          "playedAt": "2026-09-07T19:31:00.000Z",
          "durationMs": 185000
        },
        {
          "id": "2EqlS6tkEnglzr77vAhx2b",
          "title": "Come Together",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-2",
          "playedAt": "2026-09-07T19:26:00.000Z",
          "durationMs": 259000
        },
        {
          "id": "2cGxRwrMygjFu8KiMF1PFR",
          "title": "Instant Crush",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s4-3",
          "playedAt": "2026-09-07T19:22:00.000Z",
          "durationMs": 337000
        },
        {
          "id": "2Foc5Q5nqNiosCNqttzHof",
          "title": "Get Lucky",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-4",
          "playedAt": "2026-09-07T19:17:00.000Z",
          "durationMs": 369000
        },
        {
          "id": "0vFOzaXqCYFJvnudGii36Q",
          "title": "Money",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-5",
          "playedAt": "2026-09-07T19:12:00.000Z",
          "durationMs": 382000
        },
        {
          "id": "3TO7mKlbtik89FRIYod0Ij",
          "title": "Time",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-6",
          "playedAt": "2026-09-07T19:08:00.000Z",
          "durationMs": 413000
        },
        {
          "id": "5e9TFT0nj3YegNVJE4uus4",
          "title": "The Chain",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s4-7",
          "playedAt": "2026-09-07T19:03:00.000Z",
          "durationMs": 270000
        },
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-8",
          "playedAt": "2026-09-07T18:59:00.000Z",
          "durationMs": 257000
        },
        {
          "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
          "title": "I Know The End",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s4-9",
          "playedAt": "2026-09-07T18:54:00.000Z",
          "durationMs": 344000
        }
      ],
      "analysis": {
        "firstPlaysCount": 2,
        "totalTracks": 10,
        "topTrack": {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "count": 1
        },
        "topAlbum": {
          "id": "0ETFjACtuP2ADo6LFhL6HN",
          "title": "Abbey Road",
          "artist": "The Beatles",
          "count": 2
        },
        "topArtist": {
          "id": "3WrFJ7ztbogyGnTHbHJFl2",
          "name": "The Beatles",
          "count": 2
        }
      }
    },
    {
      "id": "mock-s5-4",
      "startedAt": "2026-09-07T14:10:00.000Z",
      "endedAt": "2026-09-07T14:28:00.000Z",
      "runtimeMs": 1449000,
      "trackCount": 5,
      "uniqueArtistsCount": 3,
      "isOpen": false,
      "tracks": [
        {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s5-0",
          "playedAt": "2026-09-07T14:28:00.000Z",
          "durationMs": 239000
        },
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s5-1",
          "playedAt": "2026-09-07T14:23:00.000Z",
          "durationMs": 185000
        },
        {
          "id": "2EqlS6tkEnglzr77vAhx2b",
          "title": "Come Together",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s5-2",
          "playedAt": "2026-09-07T14:19:00.000Z",
          "durationMs": 259000
        },
        {
          "id": "2cGxRwrMygjFu8KiMF1PFR",
          "title": "Instant Crush",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s5-3",
          "playedAt": "2026-09-07T14:14:00.000Z",
          "durationMs": 337000
        },
        {
          "id": "2Foc5Q5nqNiosCNqttzHof",
          "title": "Get Lucky",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s5-4",
          "playedAt": "2026-09-07T14:10:00.000Z",
          "durationMs": 369000
        }
      ],
      "analysis": {
        "firstPlaysCount": 1,
        "totalTracks": 5,
        "topTrack": {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "count": 1
        },
        "topAlbum": {
          "id": "0ETFjACtuP2ADo6LFhL6HN",
          "title": "Abbey Road",
          "artist": "The Beatles",
          "count": 2
        },
        "topArtist": {
          "id": "3WrFJ7ztbogyGnTHbHJFl2",
          "name": "The Beatles",
          "count": 2
        }
      }
    },
    {
      "id": "mock-s6-11",
      "startedAt": "2026-09-06T21:05:00.000Z",
      "endedAt": "2026-09-06T21:55:00.000Z",
      "runtimeMs": 3520000,
      "trackCount": 12,
      "uniqueArtistsCount": 12,
      "isOpen": false,
      "tracks": [
        {
          "id": "5CQ30WqJwcep0pYcV4AMNc",
          "title": "Stairway to Heaven",
          "artist": "Led Zeppelin",
          "artistId": "36QJfgBno56YwhRGFKX9Cr",
          "album": "Led Zeppelin IV",
          "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
          "swatchColor": "#3D3528",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-0",
          "playedAt": "2026-09-06T21:55:00.000Z",
          "durationMs": 482000
        },
        {
          "id": "0z9jsZt7g2t7m4FqF32r8j",
          "title": "God Only Knows",
          "artist": "The Beach Boys",
          "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
          "album": "Pet Sounds",
          "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
          "swatchColor": "#2C3A24",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-1",
          "playedAt": "2026-09-06T21:50:00.000Z",
          "durationMs": 173000
        },
        {
          "id": "0TEekvbt0ZYRucMEC0roYI",
          "title": "Ribs",
          "artist": "Lorde",
          "artistId": "163tK9Wjr9P9DmM0AVK7lm",
          "album": "Pure Heroine",
          "albumId": "0rmhj0uqT3lP906w3C0123",
          "swatchColor": "#181818",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-2",
          "playedAt": "2026-09-06T21:46:00.000Z",
          "durationMs": 258000
        },
        {
          "id": "4u7EnebtmKWzUH433cf5Qv",
          "title": "Bohemian Rhapsody",
          "artist": "Queen",
          "artistId": "1dfeR4HaWDbWqFssioeoL2",
          "album": "A Night at the Opera",
          "albumId": "1GbtB4zTqAsyfZEsm1RZSZ",
          "swatchColor": "#282828",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s6-3",
          "playedAt": "2026-09-06T21:41:00.000Z",
          "durationMs": 354000
        },
        {
          "id": "5UbUbS5bU6xM5yYVqN6sZl",
          "title": "Billie Jean",
          "artist": "Michael Jackson",
          "artistId": "3fMbdgg4jU18AjLCKBvRSm",
          "album": "Thriller",
          "albumId": "2noRn2Aes5aoQ6vUvt4mhu",
          "swatchColor": "#352E2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-4",
          "playedAt": "2026-09-06T21:37:00.000Z",
          "durationMs": 294000
        },
        {
          "id": "72Z17vmmeQKAg8bptWvpVG",
          "title": "\"Heroes\"",
          "artist": "David Bowie",
          "artistId": "0oSGxfWSnnOXhD2fKuz2Gy",
          "album": "\"Heroes\"",
          "albumId": "4I5zzKY1sp4neTeiU0W2Vw",
          "swatchColor": "#2C2C2C",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-5",
          "playedAt": "2026-09-06T21:32:00.000Z",
          "durationMs": 371000
        },
        {
          "id": "5ghIWrUSR7jAjEY0rRI7np",
          "title": "Smells Like Teen Spirit",
          "artist": "Nirvana",
          "artistId": "6olE6TJLqED3rqDCT0FyPh",
          "album": "Nevermind",
          "albumId": "2guIrUQVRq0VmsvBpJR297",
          "swatchColor": "#1A3548",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-6",
          "playedAt": "2026-09-06T21:28:00.000Z",
          "durationMs": 301000
        },
        {
          "id": "6K4t31amVTZDgR3sKmwUJJ",
          "title": "The Less I Know The Better",
          "artist": "Tame Impala",
          "artistId": "5INjqkS1o8h1imAzPqGZBb",
          "album": "Currents",
          "albumId": "79dL7FLiJFOO0EoehTaA1m",
          "swatchColor": "#3F2B48",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s6-7",
          "playedAt": "2026-09-06T21:23:00.000Z",
          "durationMs": 216000
        },
        {
          "id": "7H0ya83CMmgFcOhw0UB6ow",
          "title": "Space Song",
          "artist": "Beach House",
          "artistId": "56ZTgzPBDge0OvCGgMO3OY",
          "album": "Depression Cherry",
          "albumId": "7vK5a287L67hEw6pWbQvL8",
          "swatchColor": "#4A1525",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-8",
          "playedAt": "2026-09-06T21:19:00.000Z",
          "durationMs": 320000
        },
        {
          "id": "5FVbvFqU2sU5r0fI2b8Q7B",
          "title": "Do I Wanna Know?",
          "artist": "Arctic Monkeys",
          "artistId": "7Ln80lUS6He07XvHI8qqHH",
          "album": "AM",
          "albumId": "78bpIziExqiI91ztvVJ5nR",
          "swatchColor": "#1A1A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-9",
          "playedAt": "2026-09-06T21:14:00.000Z",
          "durationMs": 272000
        },
        {
          "id": "2Fxmhks0bxGSBdJ92v442m",
          "title": "bad guy",
          "artist": "Billie Eilish",
          "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
          "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
          "albumId": "0S0KGZnfBGSI3F0irHgAC0",
          "swatchColor": "#303028",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s6-10",
          "playedAt": "2026-09-06T21:10:00.000Z",
          "durationMs": 194000
        },
        {
          "id": "4pvb0WLRcMtbPGm22F8N0P",
          "title": "exile (feat. Bon Iver)",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s6-11",
          "playedAt": "2026-09-06T21:05:00.000Z",
          "durationMs": 285000
        }
      ],
      "analysis": {
        "firstPlaysCount": 3,
        "totalTracks": 12,
        "topTrack": {
          "id": "5CQ30WqJwcep0pYcV4AMNc",
          "title": "Stairway to Heaven",
          "artist": "Led Zeppelin",
          "count": 1
        },
        "topAlbum": {
          "id": "5EyIDBAqhnAH9Kc4qvPpeq",
          "title": "Led Zeppelin IV",
          "artist": "Led Zeppelin",
          "count": 1
        },
        "topArtist": {
          "id": "36QJfgBno56YwhRGFKX9Cr",
          "name": "Led Zeppelin",
          "count": 1
        }
      }
    },
    {
      "id": "mock-s7-2",
      "startedAt": "2026-09-06T16:40:00.000Z",
      "endedAt": "2026-09-06T16:50:00.000Z",
      "runtimeMs": 966000,
      "trackCount": 3,
      "uniqueArtistsCount": 3,
      "isOpen": false,
      "tracks": [
        {
          "id": "5UbUbS5bU6xM5yYVqN6sZl",
          "title": "Billie Jean",
          "artist": "Michael Jackson",
          "artistId": "3fMbdgg4jU18AjLCKBvRSm",
          "album": "Thriller",
          "albumId": "2noRn2Aes5aoQ6vUvt4mhu",
          "swatchColor": "#352E2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s7-0",
          "playedAt": "2026-09-06T16:50:00.000Z",
          "durationMs": 294000
        },
        {
          "id": "72Z17vmmeQKAg8bptWvpVG",
          "title": "\"Heroes\"",
          "artist": "David Bowie",
          "artistId": "0oSGxfWSnnOXhD2fKuz2Gy",
          "album": "\"Heroes\"",
          "albumId": "4I5zzKY1sp4neTeiU0W2Vw",
          "swatchColor": "#2C2C2C",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s7-1",
          "playedAt": "2026-09-06T16:45:00.000Z",
          "durationMs": 371000
        },
        {
          "id": "5ghIWrUSR7jAjEY0rRI7np",
          "title": "Smells Like Teen Spirit",
          "artist": "Nirvana",
          "artistId": "6olE6TJLqED3rqDCT0FyPh",
          "album": "Nevermind",
          "albumId": "2guIrUQVRq0VmsvBpJR297",
          "swatchColor": "#1A3548",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s7-2",
          "playedAt": "2026-09-06T16:40:00.000Z",
          "durationMs": 301000
        }
      ],
      "analysis": {
        "firstPlaysCount": 0,
        "totalTracks": 3,
        "topTrack": {
          "id": "5UbUbS5bU6xM5yYVqN6sZl",
          "title": "Billie Jean",
          "artist": "Michael Jackson",
          "count": 1
        },
        "topAlbum": {
          "id": "2noRn2Aes5aoQ6vUvt4mhu",
          "title": "Thriller",
          "artist": "Michael Jackson",
          "count": 1
        },
        "topArtist": {
          "id": "3fMbdgg4jU18AjLCKBvRSm",
          "name": "Michael Jackson",
          "count": 1
        }
      }
    },
    {
      "id": "mock-s8-14",
      "startedAt": "2026-09-05T22:00:00.000Z",
      "endedAt": "2026-09-05T23:01:00.000Z",
      "runtimeMs": 4292000,
      "trackCount": 15,
      "uniqueArtistsCount": 5,
      "isOpen": false,
      "tracks": [
        {
          "id": "74tLlkN3pmQwBvaMRA4oxE",
          "title": "Money Trees",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "good kid, m.A.A.d city",
          "albumId": "748dEZwhgnyspuaWIvlyx9",
          "swatchColor": "#3D352E",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s8-0",
          "playedAt": "2026-09-05T23:01:00.000Z",
          "durationMs": 386000
        },
        {
          "id": "0N3W5qLeLqETRpyPheLGR5",
          "title": "King Kunta",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-1",
          "playedAt": "2026-09-05T22:56:00.000Z",
          "durationMs": 234000
        },
        {
          "id": "3iVcQ50DCVupKAh0DxnZ1z",
          "title": "Alright",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-2",
          "playedAt": "2026-09-05T22:52:00.000Z",
          "durationMs": 219000
        },
        {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-3",
          "playedAt": "2026-09-05T22:48:00.000Z",
          "durationMs": 307000
        },
        {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s8-4",
          "playedAt": "2026-09-05T22:43:00.000Z",
          "durationMs": 249000
        },
        {
          "id": "19YKaevk2bce41UVk7RAum",
          "title": "Nikes",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-5",
          "playedAt": "2026-09-05T22:39:00.000Z",
          "durationMs": 314000
        },
        {
          "id": "3xKsf9qdS1CyvXS5sb08b8",
          "title": "Pink + White",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-6",
          "playedAt": "2026-09-05T22:35:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "63OQupATfueENZJaC0gNm1",
          "title": "Karma Police",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-7",
          "playedAt": "2026-09-05T22:30:00.000Z",
          "durationMs": 261000
        },
        {
          "id": "6LgJvl0Xdtc73RJ1mmpotq",
          "title": "Paranoid Android",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s8-8",
          "playedAt": "2026-09-05T22:26:00.000Z",
          "durationMs": 383000
        },
        {
          "id": "3zXh2r4hL4QhZ6qV6s0V8r",
          "title": "Reckoner",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-9",
          "playedAt": "2026-09-05T22:22:00.000Z",
          "durationMs": 290000
        },
        {
          "id": "35YyxFtlUBloXIwtav7Ch5",
          "title": "Nude",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-10",
          "playedAt": "2026-09-05T22:17:00.000Z",
          "durationMs": 255000
        },
        {
          "id": "4I2JA4Z53b01a14oH4pD2t",
          "title": "15 Step",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-11",
          "playedAt": "2026-09-05T22:13:00.000Z",
          "durationMs": 237000
        },
        {
          "id": "4clD00s1c0rVqP9Ld0vV48",
          "title": "Weird Fishes / Arpeggi",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s8-12",
          "playedAt": "2026-09-05T22:09:00.000Z",
          "durationMs": 318000
        },
        {
          "id": "5CQ30WqJwcep0pYcV4AMNc",
          "title": "Stairway to Heaven",
          "artist": "Led Zeppelin",
          "artistId": "36QJfgBno56YwhRGFKX9Cr",
          "album": "Led Zeppelin IV",
          "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
          "swatchColor": "#3D3528",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-13",
          "playedAt": "2026-09-05T22:04:00.000Z",
          "durationMs": 482000
        },
        {
          "id": "0z9jsZt7g2t7m4FqF32r8j",
          "title": "God Only Knows",
          "artist": "The Beach Boys",
          "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
          "album": "Pet Sounds",
          "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
          "swatchColor": "#2C3A24",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s8-14",
          "playedAt": "2026-09-05T22:00:00.000Z",
          "durationMs": 173000
        }
      ],
      "analysis": {
        "firstPlaysCount": 4,
        "totalTracks": 15,
        "topTrack": {
          "id": "74tLlkN3pmQwBvaMRA4oxE",
          "title": "Money Trees",
          "artist": "Kendrick Lamar",
          "count": 1
        },
        "topAlbum": {
          "id": "3mH6qwIy9crq0I9YQbOuDf",
          "title": "Blonde",
          "artist": "Frank Ocean",
          "count": 4
        },
        "topArtist": {
          "id": "4Z8W4fKeB5YxbusRsdQVPb",
          "name": "Radiohead",
          "count": 6
        }
      }
    },
    {
      "id": "mock-s9-6",
      "startedAt": "2026-09-05T13:20:00.000Z",
      "endedAt": "2026-09-05T13:47:00.000Z",
      "runtimeMs": 1988000,
      "trackCount": 7,
      "uniqueArtistsCount": 2,
      "isOpen": false,
      "tracks": [
        {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s9-0",
          "playedAt": "2026-09-05T13:47:00.000Z",
          "durationMs": 307000
        },
        {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s9-1",
          "playedAt": "2026-09-05T13:43:00.000Z",
          "durationMs": 249000
        },
        {
          "id": "19YKaevk2bce41UVk7RAum",
          "title": "Nikes",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s9-2",
          "playedAt": "2026-09-05T13:38:00.000Z",
          "durationMs": 314000
        },
        {
          "id": "3xKsf9qdS1CyvXS5sb08b8",
          "title": "Pink + White",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s9-3",
          "playedAt": "2026-09-05T13:34:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "63OQupATfueENZJaC0gNm1",
          "title": "Karma Police",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s9-4",
          "playedAt": "2026-09-05T13:29:00.000Z",
          "durationMs": 261000
        },
        {
          "id": "6LgJvl0Xdtc73RJ1mmpotq",
          "title": "Paranoid Android",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s9-5",
          "playedAt": "2026-09-05T13:25:00.000Z",
          "durationMs": 383000
        },
        {
          "id": "3zXh2r4hL4QhZ6qV6s0V8r",
          "title": "Reckoner",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s9-6",
          "playedAt": "2026-09-05T13:20:00.000Z",
          "durationMs": 290000
        }
      ],
      "analysis": {
        "firstPlaysCount": 2,
        "totalTracks": 7,
        "topTrack": {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "count": 1
        },
        "topAlbum": {
          "id": "3mH6qwIy9crq0I9YQbOuDf",
          "title": "Blonde",
          "artist": "Frank Ocean",
          "count": 4
        },
        "topArtist": {
          "id": "2h93pZq0e7k5yf4Y40u9UR",
          "name": "Frank Ocean",
          "count": 4
        }
      }
    },
    {
      "id": "mock-s10-8",
      "startedAt": "2026-09-04T19:15:00.000Z",
      "endedAt": "2026-09-04T19:51:00.000Z",
      "runtimeMs": 2409000,
      "trackCount": 9,
      "uniqueArtistsCount": 4,
      "isOpen": false,
      "tracks": [
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s10-0",
          "playedAt": "2026-09-04T19:51:00.000Z",
          "durationMs": 257000
        },
        {
          "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
          "title": "I Know The End",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s10-1",
          "playedAt": "2026-09-04T19:46:00.000Z",
          "durationMs": 344000
        },
        {
          "id": "5xo8RrjJ9CVNrtRg2S3tyW",
          "title": "Motion Sickness",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Stranger in the Alps",
          "albumId": "0AkFsgr2q1t75h8aV6uLpC",
          "swatchColor": "#282A32",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s10-2",
          "playedAt": "2026-09-04T19:42:00.000Z",
          "durationMs": 229000
        },
        {
          "id": "49UDv3b5B1bQx4K43Q486h",
          "title": "Kyoto",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s10-3",
          "playedAt": "2026-09-04T19:37:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "74tLlkN3pmQwBvaMRA4oxE",
          "title": "Money Trees",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "good kid, m.A.A.d city",
          "albumId": "748dEZwhgnyspuaWIvlyx9",
          "swatchColor": "#3D352E",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s10-4",
          "playedAt": "2026-09-04T19:33:00.000Z",
          "durationMs": 386000
        },
        {
          "id": "0N3W5qLeLqETRpyPheLGR5",
          "title": "King Kunta",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s10-5",
          "playedAt": "2026-09-04T19:28:00.000Z",
          "durationMs": 234000
        },
        {
          "id": "3iVcQ50DCVupKAh0DxnZ1z",
          "title": "Alright",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s10-6",
          "playedAt": "2026-09-04T19:24:00.000Z",
          "durationMs": 219000
        },
        {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s10-7",
          "playedAt": "2026-09-04T19:19:00.000Z",
          "durationMs": 307000
        },
        {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s10-8",
          "playedAt": "2026-09-04T19:15:00.000Z",
          "durationMs": 249000
        }
      ],
      "analysis": {
        "firstPlaysCount": 3,
        "totalTracks": 9,
        "topTrack": {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "count": 1
        },
        "topAlbum": {
          "id": "2xGQEAlDAw7whm4vvt3WvX",
          "title": "Punisher",
          "artist": "Phoebe Bridgers",
          "count": 2
        },
        "topArtist": {
          "id": "1r1uxoy19fzMxunt3ONAkG",
          "name": "Phoebe Bridgers",
          "count": 3
        }
      }
    },
    {
      "id": "mock-s11-3",
      "startedAt": "2026-09-04T11:30:00.000Z",
      "endedAt": "2026-09-04T11:44:00.000Z",
      "runtimeMs": 1024000,
      "trackCount": 4,
      "uniqueArtistsCount": 2,
      "isOpen": false,
      "tracks": [
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s11-0",
          "playedAt": "2026-09-04T11:44:00.000Z",
          "durationMs": 257000
        },
        {
          "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
          "title": "I Know The End",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s11-1",
          "playedAt": "2026-09-04T11:40:00.000Z",
          "durationMs": 344000
        },
        {
          "id": "5xo8RrjJ9CVNrtRg2S3tyW",
          "title": "Motion Sickness",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Stranger in the Alps",
          "albumId": "0AkFsgr2q1t75h8aV6uLpC",
          "swatchColor": "#282A32",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s11-2",
          "playedAt": "2026-09-04T11:35:00.000Z",
          "durationMs": 229000
        },
        {
          "id": "49UDv3b5B1bQx4K43Q486h",
          "title": "Kyoto",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s11-3",
          "playedAt": "2026-09-04T11:30:00.000Z",
          "durationMs": 184000
        }
      ],
      "analysis": {
        "firstPlaysCount": 1,
        "totalTracks": 4,
        "topTrack": {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "count": 1
        },
        "topAlbum": {
          "id": "2xGQEAlDAw7whm4vvt3WvX",
          "title": "Punisher",
          "artist": "Phoebe Bridgers",
          "count": 2
        },
        "topArtist": {
          "id": "1r1uxoy19fzMxunt3ONAkG",
          "name": "Phoebe Bridgers",
          "count": 3
        }
      }
    },
    {
      "id": "mock-s12-12",
      "startedAt": "2026-09-03T20:45:00.000Z",
      "endedAt": "2026-09-03T21:39:00.000Z",
      "runtimeMs": 3772000,
      "trackCount": 13,
      "uniqueArtistsCount": 9,
      "isOpen": false,
      "tracks": [
        {
          "id": "5ghIWrUSR7jAjEY0rRI7np",
          "title": "Smells Like Teen Spirit",
          "artist": "Nirvana",
          "artistId": "6olE6TJLqED3rqDCT0FyPh",
          "album": "Nevermind",
          "albumId": "2guIrUQVRq0VmsvBpJR297",
          "swatchColor": "#1A3548",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-0",
          "playedAt": "2026-09-03T21:39:00.000Z",
          "durationMs": 301000
        },
        {
          "id": "6K4t31amVTZDgR3sKmwUJJ",
          "title": "The Less I Know The Better",
          "artist": "Tame Impala",
          "artistId": "5INjqkS1o8h1imAzPqGZBb",
          "album": "Currents",
          "albumId": "79dL7FLiJFOO0EoehTaA1m",
          "swatchColor": "#3F2B48",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-1",
          "playedAt": "2026-09-03T21:34:00.000Z",
          "durationMs": 216000
        },
        {
          "id": "7H0ya83CMmgFcOhw0UB6ow",
          "title": "Space Song",
          "artist": "Beach House",
          "artistId": "56ZTgzPBDge0OvCGgMO3OY",
          "album": "Depression Cherry",
          "albumId": "7vK5a287L67hEw6pWbQvL8",
          "swatchColor": "#4A1525",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s12-2",
          "playedAt": "2026-09-03T21:30:00.000Z",
          "durationMs": 320000
        },
        {
          "id": "5FVbvFqU2sU5r0fI2b8Q7B",
          "title": "Do I Wanna Know?",
          "artist": "Arctic Monkeys",
          "artistId": "7Ln80lUS6He07XvHI8qqHH",
          "album": "AM",
          "albumId": "78bpIziExqiI91ztvVJ5nR",
          "swatchColor": "#1A1A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-3",
          "playedAt": "2026-09-03T21:25:00.000Z",
          "durationMs": 272000
        },
        {
          "id": "2Fxmhks0bxGSBdJ92v442m",
          "title": "bad guy",
          "artist": "Billie Eilish",
          "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
          "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
          "albumId": "0S0KGZnfBGSI3F0irHgAC0",
          "swatchColor": "#303028",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-4",
          "playedAt": "2026-09-03T21:21:00.000Z",
          "durationMs": 194000
        },
        {
          "id": "4pvb0WLRcMtbPGm22F8N0P",
          "title": "exile (feat. Bon Iver)",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-5",
          "playedAt": "2026-09-03T21:16:00.000Z",
          "durationMs": 285000
        },
        {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s12-6",
          "playedAt": "2026-09-03T21:12:00.000Z",
          "durationMs": 239000
        },
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-7",
          "playedAt": "2026-09-03T21:07:00.000Z",
          "durationMs": 185000
        },
        {
          "id": "2EqlS6tkEnglzr77vAhx2b",
          "title": "Come Together",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-8",
          "playedAt": "2026-09-03T21:03:00.000Z",
          "durationMs": 259000
        },
        {
          "id": "2cGxRwrMygjFu8KiMF1PFR",
          "title": "Instant Crush",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-9",
          "playedAt": "2026-09-03T20:58:00.000Z",
          "durationMs": 337000
        },
        {
          "id": "2Foc5Q5nqNiosCNqttzHof",
          "title": "Get Lucky",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s12-10",
          "playedAt": "2026-09-03T20:54:00.000Z",
          "durationMs": 369000
        },
        {
          "id": "0vFOzaXqCYFJvnudGii36Q",
          "title": "Money",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-11",
          "playedAt": "2026-09-03T20:49:00.000Z",
          "durationMs": 382000
        },
        {
          "id": "3TO7mKlbtik89FRIYod0Ij",
          "title": "Time",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s12-12",
          "playedAt": "2026-09-03T20:45:00.000Z",
          "durationMs": 413000
        }
      ],
      "analysis": {
        "firstPlaysCount": 3,
        "totalTracks": 13,
        "topTrack": {
          "id": "5ghIWrUSR7jAjEY0rRI7np",
          "title": "Smells Like Teen Spirit",
          "artist": "Nirvana",
          "count": 1
        },
        "topAlbum": {
          "id": "2fenSS68JI1h4Fo296JfGr",
          "title": "folklore",
          "artist": "Taylor Swift",
          "count": 2
        },
        "topArtist": {
          "id": "06HL4z0CvFAxyc27GXpf02",
          "name": "Taylor Swift",
          "count": 2
        }
      }
    },
    {
      "id": "mock-s13-5",
      "startedAt": "2026-09-03T15:10:00.000Z",
      "endedAt": "2026-09-03T15:31:00.000Z",
      "runtimeMs": 1495000,
      "trackCount": 6,
      "uniqueArtistsCount": 5,
      "isOpen": false,
      "tracks": [
        {
          "id": "7H0ya83CMmgFcOhw0UB6ow",
          "title": "Space Song",
          "artist": "Beach House",
          "artistId": "56ZTgzPBDge0OvCGgMO3OY",
          "album": "Depression Cherry",
          "albumId": "7vK5a287L67hEw6pWbQvL8",
          "swatchColor": "#4A1525",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s13-0",
          "playedAt": "2026-09-03T15:31:00.000Z",
          "durationMs": 320000
        },
        {
          "id": "5FVbvFqU2sU5r0fI2b8Q7B",
          "title": "Do I Wanna Know?",
          "artist": "Arctic Monkeys",
          "artistId": "7Ln80lUS6He07XvHI8qqHH",
          "album": "AM",
          "albumId": "78bpIziExqiI91ztvVJ5nR",
          "swatchColor": "#1A1A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s13-1",
          "playedAt": "2026-09-03T15:27:00.000Z",
          "durationMs": 272000
        },
        {
          "id": "2Fxmhks0bxGSBdJ92v442m",
          "title": "bad guy",
          "artist": "Billie Eilish",
          "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
          "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
          "albumId": "0S0KGZnfBGSI3F0irHgAC0",
          "swatchColor": "#303028",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s13-2",
          "playedAt": "2026-09-03T15:23:00.000Z",
          "durationMs": 194000
        },
        {
          "id": "4pvb0WLRcMtbPGm22F8N0P",
          "title": "exile (feat. Bon Iver)",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s13-3",
          "playedAt": "2026-09-03T15:18:00.000Z",
          "durationMs": 285000
        },
        {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s13-4",
          "playedAt": "2026-09-03T15:14:00.000Z",
          "durationMs": 239000
        },
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s13-5",
          "playedAt": "2026-09-03T15:10:00.000Z",
          "durationMs": 185000
        }
      ],
      "analysis": {
        "firstPlaysCount": 2,
        "totalTracks": 6,
        "topTrack": {
          "id": "7H0ya83CMmgFcOhw0UB6ow",
          "title": "Space Song",
          "artist": "Beach House",
          "count": 1
        },
        "topAlbum": {
          "id": "2fenSS68JI1h4Fo296JfGr",
          "title": "folklore",
          "artist": "Taylor Swift",
          "count": 2
        },
        "topArtist": {
          "id": "06HL4z0CvFAxyc27GXpf02",
          "name": "Taylor Swift",
          "count": 2
        }
      }
    },
    {
      "id": "mock-s14-18",
      "startedAt": "2026-09-02T21:30:00.000Z",
      "endedAt": "2026-09-02T22:44:00.000Z",
      "runtimeMs": 5567000,
      "trackCount": 19,
      "uniqueArtistsCount": 11,
      "isOpen": false,
      "tracks": [
        {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-0",
          "playedAt": "2026-09-02T22:44:00.000Z",
          "durationMs": 307000
        },
        {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-1",
          "playedAt": "2026-09-02T22:40:00.000Z",
          "durationMs": 249000
        },
        {
          "id": "19YKaevk2bce41UVk7RAum",
          "title": "Nikes",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s14-2",
          "playedAt": "2026-09-02T22:36:00.000Z",
          "durationMs": 314000
        },
        {
          "id": "3xKsf9qdS1CyvXS5sb08b8",
          "title": "Pink + White",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-3",
          "playedAt": "2026-09-02T22:32:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "63OQupATfueENZJaC0gNm1",
          "title": "Karma Police",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-4",
          "playedAt": "2026-09-02T22:27:00.000Z",
          "durationMs": 261000
        },
        {
          "id": "6LgJvl0Xdtc73RJ1mmpotq",
          "title": "Paranoid Android",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "OK Computer",
          "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
          "swatchColor": "#283C4A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-5",
          "playedAt": "2026-09-02T22:23:00.000Z",
          "durationMs": 383000
        },
        {
          "id": "3zXh2r4hL4QhZ6qV6s0V8r",
          "title": "Reckoner",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s14-6",
          "playedAt": "2026-09-02T22:19:00.000Z",
          "durationMs": 290000
        },
        {
          "id": "35YyxFtlUBloXIwtav7Ch5",
          "title": "Nude",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-7",
          "playedAt": "2026-09-02T22:15:00.000Z",
          "durationMs": 255000
        },
        {
          "id": "4I2JA4Z53b01a14oH4pD2t",
          "title": "15 Step",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-8",
          "playedAt": "2026-09-02T22:11:00.000Z",
          "durationMs": 237000
        },
        {
          "id": "4clD00s1c0rVqP9Ld0vV48",
          "title": "Weird Fishes / Arpeggi",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-9",
          "playedAt": "2026-09-02T22:07:00.000Z",
          "durationMs": 318000
        },
        {
          "id": "5CQ30WqJwcep0pYcV4AMNc",
          "title": "Stairway to Heaven",
          "artist": "Led Zeppelin",
          "artistId": "36QJfgBno56YwhRGFKX9Cr",
          "album": "Led Zeppelin IV",
          "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
          "swatchColor": "#3D3528",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s14-10",
          "playedAt": "2026-09-02T22:03:00.000Z",
          "durationMs": 482000
        },
        {
          "id": "0z9jsZt7g2t7m4FqF32r8j",
          "title": "God Only Knows",
          "artist": "The Beach Boys",
          "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
          "album": "Pet Sounds",
          "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
          "swatchColor": "#2C3A24",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-11",
          "playedAt": "2026-09-02T21:59:00.000Z",
          "durationMs": 173000
        },
        {
          "id": "0TEekvbt0ZYRucMEC0roYI",
          "title": "Ribs",
          "artist": "Lorde",
          "artistId": "163tK9Wjr9P9DmM0AVK7lm",
          "album": "Pure Heroine",
          "albumId": "0rmhj0uqT3lP906w3C0123",
          "swatchColor": "#181818",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-12",
          "playedAt": "2026-09-02T21:55:00.000Z",
          "durationMs": 258000
        },
        {
          "id": "4u7EnebtmKWzUH433cf5Qv",
          "title": "Bohemian Rhapsody",
          "artist": "Queen",
          "artistId": "1dfeR4HaWDbWqFssioeoL2",
          "album": "A Night at the Opera",
          "albumId": "1GbtB4zTqAsyfZEsm1RZSZ",
          "swatchColor": "#282828",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-13",
          "playedAt": "2026-09-02T21:51:00.000Z",
          "durationMs": 354000
        },
        {
          "id": "5UbUbS5bU6xM5yYVqN6sZl",
          "title": "Billie Jean",
          "artist": "Michael Jackson",
          "artistId": "3fMbdgg4jU18AjLCKBvRSm",
          "album": "Thriller",
          "albumId": "2noRn2Aes5aoQ6vUvt4mhu",
          "swatchColor": "#352E2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s14-14",
          "playedAt": "2026-09-02T21:46:00.000Z",
          "durationMs": 294000
        },
        {
          "id": "72Z17vmmeQKAg8bptWvpVG",
          "title": "\"Heroes\"",
          "artist": "David Bowie",
          "artistId": "0oSGxfWSnnOXhD2fKuz2Gy",
          "album": "\"Heroes\"",
          "albumId": "4I5zzKY1sp4neTeiU0W2Vw",
          "swatchColor": "#2C2C2C",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-15",
          "playedAt": "2026-09-02T21:42:00.000Z",
          "durationMs": 371000
        },
        {
          "id": "5ghIWrUSR7jAjEY0rRI7np",
          "title": "Smells Like Teen Spirit",
          "artist": "Nirvana",
          "artistId": "6olE6TJLqED3rqDCT0FyPh",
          "album": "Nevermind",
          "albumId": "2guIrUQVRq0VmsvBpJR297",
          "swatchColor": "#1A3548",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-16",
          "playedAt": "2026-09-02T21:38:00.000Z",
          "durationMs": 301000
        },
        {
          "id": "6K4t31amVTZDgR3sKmwUJJ",
          "title": "The Less I Know The Better",
          "artist": "Tame Impala",
          "artistId": "5INjqkS1o8h1imAzPqGZBb",
          "album": "Currents",
          "albumId": "79dL7FLiJFOO0EoehTaA1m",
          "swatchColor": "#3F2B48",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s14-17",
          "playedAt": "2026-09-02T21:34:00.000Z",
          "durationMs": 216000
        },
        {
          "id": "7H0ya83CMmgFcOhw0UB6ow",
          "title": "Space Song",
          "artist": "Beach House",
          "artistId": "56ZTgzPBDge0OvCGgMO3OY",
          "album": "Depression Cherry",
          "albumId": "7vK5a287L67hEw6pWbQvL8",
          "swatchColor": "#4A1525",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s14-18",
          "playedAt": "2026-09-02T21:30:00.000Z",
          "durationMs": 320000
        }
      ],
      "analysis": {
        "firstPlaysCount": 5,
        "totalTracks": 19,
        "topTrack": {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "count": 1
        },
        "topAlbum": {
          "id": "3mH6qwIy9crq0I9YQbOuDf",
          "title": "Blonde",
          "artist": "Frank Ocean",
          "count": 4
        },
        "topArtist": {
          "id": "4Z8W4fKeB5YxbusRsdQVPb",
          "name": "Radiohead",
          "count": 6
        }
      }
    },
    {
      "id": "mock-s15-7",
      "startedAt": "2026-09-01T18:20:00.000Z",
      "endedAt": "2026-09-01T18:51:00.000Z",
      "runtimeMs": 2367000,
      "trackCount": 8,
      "uniqueArtistsCount": 5,
      "isOpen": false,
      "tracks": [
        {
          "id": "3zXh2r4hL4QhZ6qV6s0V8r",
          "title": "Reckoner",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s15-0",
          "playedAt": "2026-09-01T18:51:00.000Z",
          "durationMs": 290000
        },
        {
          "id": "35YyxFtlUBloXIwtav7Ch5",
          "title": "Nude",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s15-1",
          "playedAt": "2026-09-01T18:46:00.000Z",
          "durationMs": 255000
        },
        {
          "id": "4I2JA4Z53b01a14oH4pD2t",
          "title": "15 Step",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s15-2",
          "playedAt": "2026-09-01T18:42:00.000Z",
          "durationMs": 237000
        },
        {
          "id": "4clD00s1c0rVqP9Ld0vV48",
          "title": "Weird Fishes / Arpeggi",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s15-3",
          "playedAt": "2026-09-01T18:38:00.000Z",
          "durationMs": 318000
        },
        {
          "id": "5CQ30WqJwcep0pYcV4AMNc",
          "title": "Stairway to Heaven",
          "artist": "Led Zeppelin",
          "artistId": "36QJfgBno56YwhRGFKX9Cr",
          "album": "Led Zeppelin IV",
          "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
          "swatchColor": "#3D3528",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s15-4",
          "playedAt": "2026-09-01T18:33:00.000Z",
          "durationMs": 482000
        },
        {
          "id": "0z9jsZt7g2t7m4FqF32r8j",
          "title": "God Only Knows",
          "artist": "The Beach Boys",
          "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
          "album": "Pet Sounds",
          "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
          "swatchColor": "#2C3A24",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s15-5",
          "playedAt": "2026-09-01T18:29:00.000Z",
          "durationMs": 173000
        },
        {
          "id": "0TEekvbt0ZYRucMEC0roYI",
          "title": "Ribs",
          "artist": "Lorde",
          "artistId": "163tK9Wjr9P9DmM0AVK7lm",
          "album": "Pure Heroine",
          "albumId": "0rmhj0uqT3lP906w3C0123",
          "swatchColor": "#181818",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s15-6",
          "playedAt": "2026-09-01T18:24:00.000Z",
          "durationMs": 258000
        },
        {
          "id": "4u7EnebtmKWzUH433cf5Qv",
          "title": "Bohemian Rhapsody",
          "artist": "Queen",
          "artistId": "1dfeR4HaWDbWqFssioeoL2",
          "album": "A Night at the Opera",
          "albumId": "1GbtB4zTqAsyfZEsm1RZSZ",
          "swatchColor": "#282828",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s15-7",
          "playedAt": "2026-09-01T18:20:00.000Z",
          "durationMs": 354000
        }
      ],
      "analysis": {
        "firstPlaysCount": 2,
        "totalTracks": 8,
        "topTrack": {
          "id": "3zXh2r4hL4QhZ6qV6s0V8r",
          "title": "Reckoner",
          "artist": "Radiohead",
          "count": 1
        },
        "topAlbum": {
          "id": "7vd91cWv27mKrnG67vR4iR",
          "title": "In Rainbows",
          "artist": "Radiohead",
          "count": 4
        },
        "topArtist": {
          "id": "4Z8W4fKeB5YxbusRsdQVPb",
          "name": "Radiohead",
          "count": 4
        }
      }
    },
    {
      "id": "mock-s16-1",
      "startedAt": "2026-09-01T12:05:00.000Z",
      "endedAt": "2026-09-01T12:11:00.000Z",
      "runtimeMs": 597000,
      "trackCount": 2,
      "uniqueArtistsCount": 1,
      "isOpen": false,
      "tracks": [
        {
          "id": "35YyxFtlUBloXIwtav7Ch5",
          "title": "Nude",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s16-0",
          "playedAt": "2026-09-01T12:11:00.000Z",
          "durationMs": 255000
        },
        {
          "id": "4I2JA4Z53b01a14oH4pD2t",
          "title": "15 Step",
          "artist": "Radiohead",
          "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
          "album": "In Rainbows",
          "albumId": "7vd91cWv27mKrnG67vR4iR",
          "swatchColor": "#3A2A1A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s16-1",
          "playedAt": "2026-09-01T12:05:00.000Z",
          "durationMs": 237000
        }
      ],
      "analysis": {
        "firstPlaysCount": 0,
        "totalTracks": 2,
        "topTrack": {
          "id": "35YyxFtlUBloXIwtav7Ch5",
          "title": "Nude",
          "artist": "Radiohead",
          "count": 1
        },
        "topAlbum": {
          "id": "7vd91cWv27mKrnG67vR4iR",
          "title": "In Rainbows",
          "artist": "Radiohead",
          "count": 2
        },
        "topArtist": {
          "id": "4Z8W4fKeB5YxbusRsdQVPb",
          "name": "Radiohead",
          "count": 2
        }
      }
    },
    {
      "id": "mock-s17-10",
      "startedAt": "2026-08-31T20:10:00.000Z",
      "endedAt": "2026-08-31T20:54:00.000Z",
      "runtimeMs": 2907000,
      "trackCount": 11,
      "uniqueArtistsCount": 4,
      "isOpen": false,
      "tracks": [
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-0",
          "playedAt": "2026-08-31T20:54:00.000Z",
          "durationMs": 257000
        },
        {
          "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
          "title": "I Know The End",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s17-1",
          "playedAt": "2026-08-31T20:49:00.000Z",
          "durationMs": 344000
        },
        {
          "id": "5xo8RrjJ9CVNrtRg2S3tyW",
          "title": "Motion Sickness",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Stranger in the Alps",
          "albumId": "0AkFsgr2q1t75h8aV6uLpC",
          "swatchColor": "#282A32",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-2",
          "playedAt": "2026-08-31T20:45:00.000Z",
          "durationMs": 229000
        },
        {
          "id": "49UDv3b5B1bQx4K43Q486h",
          "title": "Kyoto",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-3",
          "playedAt": "2026-08-31T20:41:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "74tLlkN3pmQwBvaMRA4oxE",
          "title": "Money Trees",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "good kid, m.A.A.d city",
          "albumId": "748dEZwhgnyspuaWIvlyx9",
          "swatchColor": "#3D352E",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-4",
          "playedAt": "2026-08-31T20:36:00.000Z",
          "durationMs": 386000
        },
        {
          "id": "0N3W5qLeLqETRpyPheLGR5",
          "title": "King Kunta",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s17-5",
          "playedAt": "2026-08-31T20:32:00.000Z",
          "durationMs": 234000
        },
        {
          "id": "3iVcQ50DCVupKAh0DxnZ1z",
          "title": "Alright",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-6",
          "playedAt": "2026-08-31T20:27:00.000Z",
          "durationMs": 219000
        },
        {
          "id": "7eqoqGkKwgOaWNNHx90uEZ",
          "title": "Nights",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-7",
          "playedAt": "2026-08-31T20:23:00.000Z",
          "durationMs": 307000
        },
        {
          "id": "2ZWlPOoWh0626oTaHRnl2A",
          "title": "Ivy",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-8",
          "playedAt": "2026-08-31T20:19:00.000Z",
          "durationMs": 249000
        },
        {
          "id": "19YKaevk2bce41UVk7RAum",
          "title": "Nikes",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s17-9",
          "playedAt": "2026-08-31T20:14:00.000Z",
          "durationMs": 314000
        },
        {
          "id": "3xKsf9qdS1CyvXS5sb08b8",
          "title": "Pink + White",
          "artist": "Frank Ocean",
          "artistId": "2h93pZq0e7k5yf4Y40u9UR",
          "album": "Blonde",
          "albumId": "3mH6qwIy9crq0I9YQbOuDf",
          "swatchColor": "#3B4A3A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s17-10",
          "playedAt": "2026-08-31T20:10:00.000Z",
          "durationMs": 184000
        }
      ],
      "analysis": {
        "firstPlaysCount": 3,
        "totalTracks": 11,
        "topTrack": {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "count": 1
        },
        "topAlbum": {
          "id": "3mH6qwIy9crq0I9YQbOuDf",
          "title": "Blonde",
          "artist": "Frank Ocean",
          "count": 4
        },
        "topArtist": {
          "id": "2h93pZq0e7k5yf4Y40u9UR",
          "name": "Frank Ocean",
          "count": 4
        }
      }
    },
    {
      "id": "mock-s18-15",
      "startedAt": "2026-08-30T22:15:00.000Z",
      "endedAt": "2026-08-30T23:21:00.000Z",
      "runtimeMs": 4567000,
      "trackCount": 16,
      "uniqueArtistsCount": 8,
      "isOpen": false,
      "tracks": [
        {
          "id": "2Fxmhks0bxGSBdJ92v442m",
          "title": "bad guy",
          "artist": "Billie Eilish",
          "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
          "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
          "albumId": "0S0KGZnfBGSI3F0irHgAC0",
          "swatchColor": "#303028",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-0",
          "playedAt": "2026-08-30T23:21:00.000Z",
          "durationMs": 194000
        },
        {
          "id": "4pvb0WLRcMtbPGm22F8N0P",
          "title": "exile (feat. Bon Iver)",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-1",
          "playedAt": "2026-08-30T23:16:00.000Z",
          "durationMs": 285000
        },
        {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-2",
          "playedAt": "2026-08-30T23:12:00.000Z",
          "durationMs": 239000
        },
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s18-3",
          "playedAt": "2026-08-30T23:08:00.000Z",
          "durationMs": 185000
        },
        {
          "id": "2EqlS6tkEnglzr77vAhx2b",
          "title": "Come Together",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-4",
          "playedAt": "2026-08-30T23:03:00.000Z",
          "durationMs": 259000
        },
        {
          "id": "2cGxRwrMygjFu8KiMF1PFR",
          "title": "Instant Crush",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-5",
          "playedAt": "2026-08-30T22:59:00.000Z",
          "durationMs": 337000
        },
        {
          "id": "2Foc5Q5nqNiosCNqttzHof",
          "title": "Get Lucky",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-6",
          "playedAt": "2026-08-30T22:54:00.000Z",
          "durationMs": 369000
        },
        {
          "id": "0vFOzaXqCYFJvnudGii36Q",
          "title": "Money",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s18-7",
          "playedAt": "2026-08-30T22:50:00.000Z",
          "durationMs": 382000
        },
        {
          "id": "3TO7mKlbtik89FRIYod0Ij",
          "title": "Time",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-8",
          "playedAt": "2026-08-30T22:46:00.000Z",
          "durationMs": 413000
        },
        {
          "id": "5e9TFT0nj3YegNVJE4uus4",
          "title": "The Chain",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-9",
          "playedAt": "2026-08-30T22:41:00.000Z",
          "durationMs": 270000
        },
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-10",
          "playedAt": "2026-08-30T22:37:00.000Z",
          "durationMs": 257000
        },
        {
          "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
          "title": "I Know The End",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s18-11",
          "playedAt": "2026-08-30T22:33:00.000Z",
          "durationMs": 344000
        },
        {
          "id": "5xo8RrjJ9CVNrtRg2S3tyW",
          "title": "Motion Sickness",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Stranger in the Alps",
          "albumId": "0AkFsgr2q1t75h8aV6uLpC",
          "swatchColor": "#282A32",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-12",
          "playedAt": "2026-08-30T22:28:00.000Z",
          "durationMs": 229000
        },
        {
          "id": "49UDv3b5B1bQx4K43Q486h",
          "title": "Kyoto",
          "artist": "Phoebe Bridgers",
          "artistId": "1r1uxoy19fzMxunt3ONAkG",
          "album": "Punisher",
          "albumId": "2xGQEAlDAw7whm4vvt3WvX",
          "swatchColor": "#3A1E22",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-13",
          "playedAt": "2026-08-30T22:24:00.000Z",
          "durationMs": 184000
        },
        {
          "id": "74tLlkN3pmQwBvaMRA4oxE",
          "title": "Money Trees",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "good kid, m.A.A.d city",
          "albumId": "748dEZwhgnyspuaWIvlyx9",
          "swatchColor": "#3D352E",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s18-14",
          "playedAt": "2026-08-30T22:19:00.000Z",
          "durationMs": 386000
        },
        {
          "id": "0N3W5qLeLqETRpyPheLGR5",
          "title": "King Kunta",
          "artist": "Kendrick Lamar",
          "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
          "album": "To Pimp a Butterfly",
          "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
          "swatchColor": "#222222",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s18-15",
          "playedAt": "2026-08-30T22:15:00.000Z",
          "durationMs": 234000
        }
      ],
      "analysis": {
        "firstPlaysCount": 4,
        "totalTracks": 16,
        "topTrack": {
          "id": "2Fxmhks0bxGSBdJ92v442m",
          "title": "bad guy",
          "artist": "Billie Eilish",
          "count": 1
        },
        "topAlbum": {
          "id": "2fenSS68JI1h4Fo296JfGr",
          "title": "folklore",
          "artist": "Taylor Swift",
          "count": 2
        },
        "topArtist": {
          "id": "1r1uxoy19fzMxunt3ONAkG",
          "name": "Phoebe Bridgers",
          "count": 3
        }
      }
    },
    {
      "id": "mock-s19-7",
      "startedAt": "2026-08-29T19:40:00.000Z",
      "endedAt": "2026-08-29T20:12:00.000Z",
      "runtimeMs": 2472000,
      "trackCount": 8,
      "uniqueArtistsCount": 4,
      "isOpen": false,
      "tracks": [
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s19-0",
          "playedAt": "2026-08-29T20:12:00.000Z",
          "durationMs": 185000
        },
        {
          "id": "2EqlS6tkEnglzr77vAhx2b",
          "title": "Come Together",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s19-1",
          "playedAt": "2026-08-29T20:07:00.000Z",
          "durationMs": 259000
        },
        {
          "id": "2cGxRwrMygjFu8KiMF1PFR",
          "title": "Instant Crush",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s19-2",
          "playedAt": "2026-08-29T20:03:00.000Z",
          "durationMs": 337000
        },
        {
          "id": "2Foc5Q5nqNiosCNqttzHof",
          "title": "Get Lucky",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s19-3",
          "playedAt": "2026-08-29T19:58:00.000Z",
          "durationMs": 369000
        },
        {
          "id": "0vFOzaXqCYFJvnudGii36Q",
          "title": "Money",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s19-4",
          "playedAt": "2026-08-29T19:54:00.000Z",
          "durationMs": 382000
        },
        {
          "id": "3TO7mKlbtik89FRIYod0Ij",
          "title": "Time",
          "artist": "Pink Floyd",
          "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
          "album": "The Dark Side of the Moon",
          "albumId": "4LH4d3cOWNNXdsqFd42wzg",
          "swatchColor": "#141414",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s19-5",
          "playedAt": "2026-08-29T19:49:00.000Z",
          "durationMs": 413000
        },
        {
          "id": "5e9TFT0nj3YegNVJE4uus4",
          "title": "The Chain",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s19-6",
          "playedAt": "2026-08-29T19:45:00.000Z",
          "durationMs": 270000
        },
        {
          "id": "0ofHAoxe9vBkTCp2UQIavz",
          "title": "Dreams",
          "artist": "Fleetwood Mac",
          "artistId": "08GQAI4e5rBaRujQwE7AVn",
          "album": "Rumours",
          "albumId": "1BZhsjlBYzDbKyJdYBMxev",
          "swatchColor": "#3A3428",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s19-7",
          "playedAt": "2026-08-29T19:40:00.000Z",
          "durationMs": 257000
        }
      ],
      "analysis": {
        "firstPlaysCount": 2,
        "totalTracks": 8,
        "topTrack": {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "count": 1
        },
        "topAlbum": {
          "id": "0ETFjACtuP2ADo6LFhL6HN",
          "title": "Abbey Road",
          "artist": "The Beatles",
          "count": 2
        },
        "topArtist": {
          "id": "3WrFJ7ztbogyGnTHbHJFl2",
          "name": "The Beatles",
          "count": 2
        }
      }
    },
    {
      "id": "mock-s20-4",
      "startedAt": "2026-08-28T21:10:00.000Z",
      "endedAt": "2026-08-28T21:29:00.000Z",
      "runtimeMs": 1477000,
      "trackCount": 5,
      "uniqueArtistsCount": 3,
      "isOpen": false,
      "tracks": [
        {
          "id": "4pvb0WLRcMtbPGm22F8N0P",
          "title": "exile (feat. Bon Iver)",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s20-0",
          "playedAt": "2026-08-28T21:29:00.000Z",
          "durationMs": 285000
        },
        {
          "id": "4R2kfaDFslZEMLoQUTosRH",
          "title": "cardigan",
          "artist": "Taylor Swift",
          "artistId": "06HL4z0CvFAxyc27GXpf02",
          "album": "folklore",
          "albumId": "2fenSS68JI1h4Fo296JfGr",
          "swatchColor": "#303030",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s20-1",
          "playedAt": "2026-08-28T21:24:00.000Z",
          "durationMs": 239000
        },
        {
          "id": "6dGnYIeXmYdcikdzNNDMm2",
          "title": "Here Comes The Sun",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": true,
          "playId": "mock-s20-2",
          "playedAt": "2026-08-28T21:20:00.000Z",
          "durationMs": 185000
        },
        {
          "id": "2EqlS6tkEnglzr77vAhx2b",
          "title": "Come Together",
          "artist": "The Beatles",
          "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
          "album": "Abbey Road",
          "albumId": "0ETFjACtuP2ADo6LFhL6HN",
          "swatchColor": "#2D3E35",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s20-3",
          "playedAt": "2026-08-28T21:15:00.000Z",
          "durationMs": 259000
        },
        {
          "id": "2cGxRwrMygjFu8KiMF1PFR",
          "title": "Instant Crush",
          "artist": "Daft Punk",
          "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
          "album": "Random Access Memories",
          "albumId": "4m2880jivSbbyEGAKfITCa",
          "swatchColor": "#2A2A2A",
          "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
          "isFirstPlay": false,
          "playId": "mock-s20-4",
          "playedAt": "2026-08-28T21:10:00.000Z",
          "durationMs": 337000
        }
      ],
      "analysis": {
        "firstPlaysCount": 1,
        "totalTracks": 5,
        "topTrack": {
          "id": "4pvb0WLRcMtbPGm22F8N0P",
          "title": "exile (feat. Bon Iver)",
          "artist": "Taylor Swift",
          "count": 1
        },
        "topAlbum": {
          "id": "2fenSS68JI1h4Fo296JfGr",
          "title": "folklore",
          "artist": "Taylor Swift",
          "count": 2
        },
        "topArtist": {
          "id": "06HL4z0CvFAxyc27GXpf02",
          "name": "Taylor Swift",
          "count": 2
        }
      }
    }
  ]
}
};
