export type Mode = 0 | 1 | 2; // 0 = Overview, 1 = Stream Log, 2 = Session
export type RangeKey = "1d" | "1w" | "1m" | "6m" | "1y" | "all";

export interface TrackSummary {
  id: string;
  rank: string; // '01'
  drift: "·" | "+1" | "-1" | "+2" | "-2" | "NEW";
  name: string;
  artist: string;
  artistId?: string;
  album: string;
  albumId?: string;
  duration: string; // '5:18'
  plays: number;
  swatchColor: string;
  albumImageUrl?: string | null;
}

export interface StreamLogItem {
  id: string;
  trackId?: string;
  artistId?: string;
  albumId?: string;
  playedAt?: string;
  timeStr: string; // '21:02'
  title: string;
  artist: string;
  album: string;
  duration: string;
  albumImageUrl?: string | null;
  status?: string;
  dayGroup?: string; // '09 SEP'
  sessionGap?: {
    durationStr: string;
    sittingLabel: string;
  };
}

export interface SittingItem {
  id: string;
  artistId?: string;
  albumId?: string;
  timestamp: string; // '23:47'
  title: string;
  artist: string;
  album: string;
  swatchColor: string;
  albumImageUrl?: string | null;
  isActive?: boolean;
  isFirstPlay?: boolean;
  duration?: string;
}

export interface PreviousSitting {
  id?: string;
  dateStr: string; // '09 SEP'
  durationStr: string; // '1h 14m'
  tracksCountStr: string; // '18 tracks'
  runtimeMinutes?: number;
  trackCount?: number;
}

export interface SittingAnalysis {
  firstPlaysCount: number;
  totalTracks: number;
  topSong: { title: string; count: number; id?: string; artist?: string } | null;
  topAlbum: { title: string; count: number; id?: string; artist?: string };
  topArtist: { name: string; count: number; id?: string };
}

export interface SittingSession {
  id: string;
  dateStr: string;
  runtimeMinutes: number;
  runtimeStr: string;
  trackCount: number;
  uniqueArtistsCount: number;
  startTime: string;
  tagTime?: string;
  isOpen: boolean;
  tracks: SittingItem[];
  analysis: SittingAnalysis;
}

export interface SessionHistogramBar {
  id: string;
  runtimeMinutes: number;
  dateStr: string;
  title: string;
}

export interface SessionHistogramData {
  avgRuntimeMinutes: number;
  oldestDate: string;
  newestDate: string;
  bars: SessionHistogramBar[];
}

export interface SessionData {
  isOpen: boolean;
  tagTime: string; // '22:15 CDT' or '18M'
  metrics: [string, string, string, string]; // Runtime, Tracks, Unique Artists, Start Time
  sittingTracks: SittingItem[];
  previousSittings: PreviousSitting[];
  lastSyncedAt?: string;
  sittings?: SittingSession[];
  histogram?: SessionHistogramData;
}

export interface AlbumSummary {
  id?: string;
  rank: string; // '01', '02', etc.
  name: string; // e.g., 'Blonde'
  artist: string; // e.g., 'Frank Ocean'
  artistId?: string;
  count: number; // e.g., 241
}

export interface ActivityDay {
  date: string; // '05 SEP', 'W34', etc.
  count: number;
  isMarker?: boolean;
  markerLabel?: string;
}

export interface OverviewData {
  logStartDate: string;
  metrics: [string, string, string, string]; // Minutes, Tracks, Artists, Daily Avg
  topTracks: TrackSummary[];
  topArtists: Array<{ rank: string; name: string; count: number; id?: string }>;
  topAlbums: AlbumSummary[];
  clockBuckets?: number[]; // 24 values
  activityCadence?: ActivityDay[]; // Multi-scale activity distribution
}

export interface MockListeningData {
  overview: Record<RangeKey, OverviewData>;
  streamLog: {
    metrics: [string, string, string, string]; // Plays, Time, Artists, Streak
    entries: StreamLogItem[];
    nextCursor?: string | null;
    nextCursorId?: string | null;
    hasMore?: boolean;
    lastSyncedAt?: string;
  };
  session: SessionData;
}

// ---------------------------------------------------------------------------
// Canonical Music Catalog (Curated English Tracks with Verified Spotify Metadata)
// ---------------------------------------------------------------------------

export const CATALOG = {
  radiohead_weird_fishes: {
    id: "4clD00s1c0rVqP9Ld0vV48",
    name: "Weird Fishes / Arpeggi",
    artist: "Radiohead",
    artistId: "4Z8W4fKeB5YxbusRsdQVPb",
    album: "In Rainbows",
    albumId: "7vd91cWv27mKrnG67vR4iR",
    duration: "5:18",
    swatchColor: "#3A2A1A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
  },
  radiohead_15_step: {
    id: "4I2JA4Z53b01a14oH4pD2t",
    name: "15 Step",
    artist: "Radiohead",
    artistId: "4Z8W4fKeB5YxbusRsdQVPb",
    album: "In Rainbows",
    albumId: "7vd91cWv27mKrnG67vR4iR",
    duration: "3:57",
    swatchColor: "#3A2A1A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
  },
  radiohead_nude: {
    id: "35YyxFtlUBloXIwtav7Ch5",
    name: "Nude",
    artist: "Radiohead",
    artistId: "4Z8W4fKeB5YxbusRsdQVPb",
    album: "In Rainbows",
    albumId: "7vd91cWv27mKrnG67vR4iR",
    duration: "4:15",
    swatchColor: "#3A2A1A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
  },
  radiohead_reckoner: {
    id: "3zXh2r4hL4QhZ6qV6s0V8r",
    name: "Reckoner",
    artist: "Radiohead",
    artistId: "4Z8W4fKeB5YxbusRsdQVPb",
    album: "In Rainbows",
    albumId: "7vd91cWv27mKrnG67vR4iR",
    duration: "4:50",
    swatchColor: "#3A2A1A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
  },
  radiohead_paranoid_android: {
    id: "6LgJvl0Xdtc73RJ1mmpotq",
    name: "Paranoid Android",
    artist: "Radiohead",
    artistId: "4Z8W4fKeB5YxbusRsdQVPb",
    album: "OK Computer",
    albumId: "6dVIqQ8qmQ5GBnJ9shOYGE",
    duration: "6:23",
    swatchColor: "#283C4A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
  },
  radiohead_karma_police: {
    id: "63OQupATfueENZJaC0gNm1",
    name: "Karma Police",
    artist: "Radiohead",
    artistId: "4Z8W4fKeB5YxbusRsdQVPb",
    album: "OK Computer",
    albumId: "6dVIqQ8qmQ5GBnJ9shOYGE",
    duration: "4:21",
    swatchColor: "#283C4A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
  },
  frank_ocean_pink_white: {
    id: "3xKsf9qdS1CyvXS5sb08b8",
    name: "Pink + White",
    artist: "Frank Ocean",
    artistId: "2h93pZq0e7k5yf4Y40u9UR",
    album: "Blonde",
    albumId: "3mH6qwIy9crq0I9YQbOuDf",
    duration: "3:04",
    swatchColor: "#3B4A3A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
  },
  frank_ocean_nikes: {
    id: "19YKaevk2bce41UVk7RAum",
    name: "Nikes",
    artist: "Frank Ocean",
    artistId: "2h93pZq0e7k5yf4Y40u9UR",
    album: "Blonde",
    albumId: "3mH6qwIy9crq0I9YQbOuDf",
    duration: "5:14",
    swatchColor: "#3B4A3A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
  },
  frank_ocean_ivy: {
    id: "2ZWlPOoWh0626oTaHRnl2A",
    name: "Ivy",
    artist: "Frank Ocean",
    artistId: "2h93pZq0e7k5yf4Y40u9UR",
    album: "Blonde",
    albumId: "3mH6qwIy9crq0I9YQbOuDf",
    duration: "4:09",
    swatchColor: "#3B4A3A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
  },
  frank_ocean_nights: {
    id: "7eqoqGkKwgOaWNNHx90uEZ",
    name: "Nights",
    artist: "Frank Ocean",
    artistId: "2h93pZq0e7k5yf4Y40u9UR",
    album: "Blonde",
    albumId: "3mH6qwIy9crq0I9YQbOuDf",
    duration: "5:07",
    swatchColor: "#3B4A3A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
  },
  kendrick_alright: {
    id: "3iVcQ50DCVupKAh0DxnZ1z",
    name: "Alright",
    artist: "Kendrick Lamar",
    artistId: "2YZyLoL8N0Wb9xBt1NhZWg",
    album: "To Pimp a Butterfly",
    albumId: "7ycBtnsMtyVbbw3fMwR2nM",
    duration: "3:39",
    swatchColor: "#222222",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
  },
  kendrick_king_kunta: {
    id: "0N3W5qLeLqETRpyPheLGR5",
    name: "King Kunta",
    artist: "Kendrick Lamar",
    artistId: "2YZyLoL8N0Wb9xBt1NhZWg",
    album: "To Pimp a Butterfly",
    albumId: "7ycBtnsMtyVbbw3fMwR2nM",
    duration: "3:54",
    swatchColor: "#222222",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
  },
  kendrick_money_trees: {
    id: "74tLlkN3pmQwBvaMRA4oxE",
    name: "Money Trees",
    artist: "Kendrick Lamar",
    artistId: "2YZyLoL8N0Wb9xBt1NhZWg",
    album: "good kid, m.A.A.d city",
    albumId: "748dEZwhgnyspuaWIvlyx9",
    duration: "6:26",
    swatchColor: "#3D352E",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
  },
  phoebe_kyoto: {
    id: "49UDv3b5B1bQx4K43Q486h",
    name: "Kyoto",
    artist: "Phoebe Bridgers",
    artistId: "1r1uxoy19fzMxunt3ONAkG",
    album: "Punisher",
    albumId: "2xGQEAlDAw7whm4vvt3WvX",
    duration: "3:04",
    swatchColor: "#3A1E22",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
  },
  phoebe_motion_sickness: {
    id: "5xo8RrjJ9CVNrtRg2S3tyW",
    name: "Motion Sickness",
    artist: "Phoebe Bridgers",
    artistId: "1r1uxoy19fzMxunt3ONAkG",
    album: "Stranger in the Alps",
    albumId: "0AkFsgr2q1t75h8aV6uLpC",
    duration: "3:49",
    swatchColor: "#282A32",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
  },
  phoebe_i_know_the_end: {
    id: "3CRDbSIZ4r5MsZ0YwxuEkn",
    name: "I Know The End",
    artist: "Phoebe Bridgers",
    artistId: "1r1uxoy19fzMxunt3ONAkG",
    album: "Punisher",
    albumId: "2xGQEAlDAw7whm4vvt3WvX",
    duration: "5:44",
    swatchColor: "#3A1E22",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
  },
  fleetwood_dreams: {
    id: "0ofHAoxe9vBkTCp2UQIavz",
    name: "Dreams",
    artist: "Fleetwood Mac",
    artistId: "08GQAI4e5rBaRujQwE7AVn",
    album: "Rumours",
    albumId: "1BZhsjlBYzDbKyJdYBMxev",
    duration: "4:17",
    swatchColor: "#3A3428",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
  },
  fleetwood_the_chain: {
    id: "5e9TFT0nj3YegNVJE4uus4",
    name: "The Chain",
    artist: "Fleetwood Mac",
    artistId: "08GQAI4e5rBaRujQwE7AVn",
    album: "Rumours",
    albumId: "1BZhsjlBYzDbKyJdYBMxev",
    duration: "4:30",
    swatchColor: "#3A3428",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
  },
  pink_floyd_time: {
    id: "3TO7mKlbtik89FRIYod0Ij",
    name: "Time",
    artist: "Pink Floyd",
    artistId: "0k17h0D3J5VfsdmQ1iZtE9",
    album: "The Dark Side of the Moon",
    albumId: "4LH4d3cOWNNXdsqFd42wzg",
    duration: "6:53",
    swatchColor: "#141414",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
  },
  pink_floyd_money: {
    id: "0vFOzaXqCYFJvnudGii36Q",
    name: "Money",
    artist: "Pink Floyd",
    artistId: "0k17h0D3J5VfsdmQ1iZtE9",
    album: "The Dark Side of the Moon",
    albumId: "4LH4d3cOWNNXdsqFd42wzg",
    duration: "6:22",
    swatchColor: "#141414",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
  },
  daft_punk_get_lucky: {
    id: "2Foc5Q5nqNiosCNqttzHof",
    name: "Get Lucky",
    artist: "Daft Punk",
    artistId: "4tZwfgrHOc3mvqYxwDoOD1",
    album: "Random Access Memories",
    albumId: "4m2880jivSbbyEGAKfITCa",
    duration: "6:09",
    swatchColor: "#2A2A2A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
  },
  daft_punk_instant_crush: {
    id: "2cGxRwrMygjFu8KiMF1PFR",
    name: "Instant Crush",
    artist: "Daft Punk",
    artistId: "4tZwfgrHOc3mvqYxwDoOD1",
    album: "Random Access Memories",
    albumId: "4m2880jivSbbyEGAKfITCa",
    duration: "5:37",
    swatchColor: "#2A2A2A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
  },
  beatles_come_together: {
    id: "2EqlS6tkEnglzr77vAhx2b",
    name: "Come Together",
    artist: "The Beatles",
    artistId: "3WrFJ7ztbogyGnTHbHJFl2",
    album: "Abbey Road",
    albumId: "0ETFjACtuP2ADo6LFhL6HN",
    duration: "4:19",
    swatchColor: "#2D3E35",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
  },
  beatles_here_comes_the_sun: {
    id: "6dGnYIeXmYdcikdzNNDMm2",
    name: "Here Comes The Sun",
    artist: "The Beatles",
    artistId: "3WrFJ7ztbogyGnTHbHJFl2",
    album: "Abbey Road",
    albumId: "0ETFjACtuP2ADo6LFhL6HN",
    duration: "3:05",
    swatchColor: "#2D3E35",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
  },
  taylor_swift_cardigan: {
    id: "4R2kfaDFslZEMLoQUTosRH",
    name: "cardigan",
    artist: "Taylor Swift",
    artistId: "06HL4z0CvFAxyc27GXpf02",
    album: "folklore",
    albumId: "2fenSS68JI1h4Fo296JfGr",
    duration: "3:59",
    swatchColor: "#303030",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
  },
  taylor_swift_exile: {
    id: "4pvb0WLRcMtbPGm22F8N0P",
    name: "exile (feat. Bon Iver)",
    artist: "Taylor Swift",
    artistId: "06HL4z0CvFAxyc27GXpf02",
    album: "folklore",
    albumId: "2fenSS68JI1h4Fo296JfGr",
    duration: "4:45",
    swatchColor: "#303030",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
  },
  billie_eilish_bad_guy: {
    id: "2Fxmhks0bxGSBdJ92v442m",
    name: "bad guy",
    artist: "Billie Eilish",
    artistId: "6qqNVTkY8uBg9cP3Jd7DAH",
    album: "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
    albumId: "0S0KGZnfBGSI3F0irHgAC0",
    duration: "3:14",
    swatchColor: "#303028",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
  },
  arctic_monkeys_do_i_wanna_know: {
    id: "5FVbvFqU2sU5r0fI2b8Q7B",
    name: "Do I Wanna Know?",
    artist: "Arctic Monkeys",
    artistId: "7Ln80lUS6He07XvHI8qqHH",
    album: "AM",
    albumId: "78bpIziExqiI91ztvVJ5nR",
    duration: "4:32",
    swatchColor: "#1A1A1A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
  },
  beach_house_space_song: {
    id: "7H0ya83CMmgFcOhw0UB6ow",
    name: "Space Song",
    artist: "Beach House",
    artistId: "56ZTgzPBDge0OvCGgMO3OY",
    album: "Depression Cherry",
    albumId: "7vK5a287L67hEw6pWbQvL8",
    duration: "5:20",
    swatchColor: "#4A1525",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
  },
  tame_impala_less_i_know: {
    id: "6K4t31amVTZDgR3sKmwUJJ",
    name: "The Less I Know The Better",
    artist: "Tame Impala",
    artistId: "5INjqkS1o8h1imAzPqGZBb",
    album: "Currents",
    albumId: "79dL7FLiJFOO0EoehTaA1m",
    duration: "3:36",
    swatchColor: "#3F2B48",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
  },
  nirvana_teen_spirit: {
    id: "5ghIWrUSR7jAjEY0rRI7np",
    name: "Smells Like Teen Spirit",
    artist: "Nirvana",
    artistId: "6olE6TJLqED3rqDCT0FyPh",
    album: "Nevermind",
    albumId: "2guIrUQVRq0VmsvBpJR297",
    duration: "5:01",
    swatchColor: "#1A3548",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
  },
  david_bowie_heroes: {
    id: "72Z17vmmeQKAg8bptWvpVG",
    name: "\"Heroes\"",
    artist: "David Bowie",
    artistId: "0oSGxfWSnnOXhD2fKuz2Gy",
    album: "\"Heroes\"",
    albumId: "4I5zzKY1sp4neTeiU0W2Vw",
    duration: "6:11",
    swatchColor: "#2C2C2C",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
  },
  michael_jackson_billie_jean: {
    id: "5UbUbS5bU6xM5yYVqN6sZl",
    name: "Billie Jean",
    artist: "Michael Jackson",
    artistId: "3fMbdgg4jU18AjLCKBvRSm",
    album: "Thriller",
    albumId: "2noRn2Aes5aoQ6vUvt4mhu",
    duration: "4:54",
    swatchColor: "#352E2A",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
  },
  queen_bohemian_rhapsody: {
    id: "4u7EnebtmKWzUH433cf5Qv",
    name: "Bohemian Rhapsody",
    artist: "Queen",
    artistId: "1dfeR4HaWDbWqFssioeoL2",
    album: "A Night at the Opera",
    albumId: "1GbtB4zTqAsyfZEsm1RZSZ",
    duration: "5:54",
    swatchColor: "#282828",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
  },
  lorde_ribs: {
    id: "0TEekvbt0ZYRucMEC0roYI",
    name: "Ribs",
    artist: "Lorde",
    artistId: "163tK9Wjr9P9DmM0AVK7lm",
    album: "Pure Heroine",
    albumId: "0rmhj0uqT3lP906w3C0123",
    duration: "4:18",
    swatchColor: "#181818",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
  },
  beach_boys_god_only_knows: {
    id: "0z9jsZt7g2t7m4FqF32r8j",
    name: "God Only Knows",
    artist: "The Beach Boys",
    artistId: "3pkZyq0Zl0aUe8vFhA0w2v",
    album: "Pet Sounds",
    albumId: "6DuBaIuxuE2Mv39R4B9jYn",
    duration: "2:53",
    swatchColor: "#2C3A24",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
  },
  led_zeppelin_stairway: {
    id: "5CQ30WqJwcep0pYcV4AMNc",
    name: "Stairway to Heaven",
    artist: "Led Zeppelin",
    artistId: "36QJfgBno56YwhRGFKX9Cr",
    album: "Led Zeppelin IV",
    albumId: "5EyIDBAqhnAH9Kc4qvPpeq",
    duration: "8:02",
    swatchColor: "#3D3528",
    albumImageUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
  },
};

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
        return Array.from({ length: 24 }, (_, idx) => {
          const hoursAgo = 23 - idx;
          const h = (new Date().getHours() - hoursAgo + 24) % 24;
          return {
            date: `${h < 10 ? `0${h}` : h}:00`,
            count: counts[idx % counts.length],
          };
        });
      })(),
    },
    "1w": {
      logStartDate: "02 SEP 2026",
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
        const blocks: ActivityDay[] = [];
        const BLOCK_TIMES = ["00:00–06:00", "06:00–12:00", "12:00–18:00", "18:00–24:00"];
        const dayLabels = ["03 SEP", "04 SEP", "05 SEP", "06 SEP", "07 SEP", "08 SEP", "09 SEP"];
        for (let i = 0; i < 7; i++) {
          for (let b = 0; b < 4; b++) {
            const count = Math.max(1, Math.round(Math.sin((i * 4 + b) * 0.6) * 10 + 9));
            blocks.push({
              date: `${dayLabels[i]} ${BLOCK_TIMES[b]}`,
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
        return {
          date: dStr,
          count: 14 + Math.round(Math.sin(i * 0.45) * 12 + (i % 4) * 6),
          isMarker,
          markerLabel: isMarker ? dStr : undefined,
        };
      }),
    },
    "6m": {
      logStartDate: "09 MAR 2026",
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
      activityCadence: Array.from({ length: 26 }, (_, i) => ({
        date: `W${i + 1}`,
        count: 85 + Math.round(Math.sin(i * 0.38) * 38 + (i % 3) * 14),
      })),
    },
    "1y": {
      logStartDate: "09 SEP 2025",
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
        "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP"
      ].map((date, i) => ({
        date,
        count: 95 + Math.round(Math.sin(i * 0.48) * 36 + (i % 4) * 12),
      })),
    },
    all: {
      logStartDate: "14 AUG 2024",
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
      activityCadence: [
        "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP"
      ].map((date, i) => ({
        date,
        count: 125 + Math.round(Math.cos(i * 0.45) * 44 + (i % 3) * 18),
      })),
    },
  },

  // -------------------------------------------------------------------------
  // Mode 1: Stream Log (50 Plays, Day Groups, Session Gaps)
  // -------------------------------------------------------------------------
  streamLog: {
    metrics: ["150", "9h 45m", "34", "14 DAYS"],
    hasMore: true,
    nextCursor: "2026-09-07T18:54:00.000Z",
    nextCursorId: "sl-50",
    entries: [
      // Day Group: 09 SEP (Today - Evening Sitting)
      {
        id: "sl-1",
        timeStr: "23:44",
        title: CATALOG.radiohead_weird_fishes.name,
        artist: CATALOG.radiohead_weird_fishes.artist,
        artistId: CATALOG.radiohead_weird_fishes.artistId,
        album: CATALOG.radiohead_weird_fishes.album,
        albumId: CATALOG.radiohead_weird_fishes.albumId,
        duration: CATALOG.radiohead_weird_fishes.duration,
        albumImageUrl: CATALOG.radiohead_weird_fishes.albumImageUrl,
        dayGroup: "09 SEP",
      },
      {
        id: "sl-2",
        timeStr: "23:38",
        title: CATALOG.radiohead_15_step.name,
        artist: CATALOG.radiohead_15_step.artist,
        artistId: CATALOG.radiohead_15_step.artistId,
        album: CATALOG.radiohead_15_step.album,
        albumId: CATALOG.radiohead_15_step.albumId,
        duration: CATALOG.radiohead_15_step.duration,
        albumImageUrl: CATALOG.radiohead_15_step.albumImageUrl,
      },
      {
        id: "sl-3",
        timeStr: "23:34",
        title: CATALOG.frank_ocean_pink_white.name,
        artist: CATALOG.frank_ocean_pink_white.artist,
        artistId: CATALOG.frank_ocean_pink_white.artistId,
        album: CATALOG.frank_ocean_pink_white.album,
        albumId: CATALOG.frank_ocean_pink_white.albumId,
        duration: CATALOG.frank_ocean_pink_white.duration,
        albumImageUrl: CATALOG.frank_ocean_pink_white.albumImageUrl,
      },
      {
        id: "sl-4",
        timeStr: "23:29",
        title: CATALOG.frank_ocean_ivy.name,
        artist: CATALOG.frank_ocean_ivy.artist,
        artistId: CATALOG.frank_ocean_ivy.artistId,
        album: CATALOG.frank_ocean_ivy.album,
        albumId: CATALOG.frank_ocean_ivy.albumId,
        duration: CATALOG.frank_ocean_ivy.duration,
        albumImageUrl: CATALOG.frank_ocean_ivy.albumImageUrl,
      },
      {
        id: "sl-5",
        timeStr: "23:24",
        title: CATALOG.kendrick_alright.name,
        artist: CATALOG.kendrick_alright.artist,
        artistId: CATALOG.kendrick_alright.artistId,
        album: CATALOG.kendrick_alright.album,
        albumId: CATALOG.kendrick_alright.albumId,
        duration: CATALOG.kendrick_alright.duration,
        albumImageUrl: CATALOG.kendrick_alright.albumImageUrl,
      },
      {
        id: "sl-6",
        timeStr: "23:20",
        title: CATALOG.phoebe_kyoto.name,
        artist: CATALOG.phoebe_kyoto.artist,
        artistId: CATALOG.phoebe_kyoto.artistId,
        album: CATALOG.phoebe_kyoto.album,
        albumId: CATALOG.phoebe_kyoto.albumId,
        duration: CATALOG.phoebe_kyoto.duration,
        albumImageUrl: CATALOG.phoebe_kyoto.albumImageUrl,
      },
      {
        id: "sl-7",
        timeStr: "23:14",
        title: CATALOG.phoebe_i_know_the_end.name,
        artist: CATALOG.phoebe_i_know_the_end.artist,
        artistId: CATALOG.phoebe_i_know_the_end.artistId,
        album: CATALOG.phoebe_i_know_the_end.album,
        albumId: CATALOG.phoebe_i_know_the_end.albumId,
        duration: CATALOG.phoebe_i_know_the_end.duration,
        albumImageUrl: CATALOG.phoebe_i_know_the_end.albumImageUrl,
      },
      {
        id: "sl-8",
        timeStr: "23:09",
        title: CATALOG.fleetwood_dreams.name,
        artist: CATALOG.fleetwood_dreams.artist,
        artistId: CATALOG.fleetwood_dreams.artistId,
        album: CATALOG.fleetwood_dreams.album,
        albumId: CATALOG.fleetwood_dreams.albumId,
        duration: CATALOG.fleetwood_dreams.duration,
        albumImageUrl: CATALOG.fleetwood_dreams.albumImageUrl,
      },
      {
        id: "sl-9",
        timeStr: "23:04",
        title: CATALOG.fleetwood_the_chain.name,
        artist: CATALOG.fleetwood_the_chain.artist,
        artistId: CATALOG.fleetwood_the_chain.artistId,
        album: CATALOG.fleetwood_the_chain.album,
        albumId: CATALOG.fleetwood_the_chain.albumId,
        duration: CATALOG.fleetwood_the_chain.duration,
        albumImageUrl: CATALOG.fleetwood_the_chain.albumImageUrl,
      },
      {
        id: "sl-10",
        timeStr: "22:58",
        title: CATALOG.pink_floyd_time.name,
        artist: CATALOG.pink_floyd_time.artist,
        artistId: CATALOG.pink_floyd_time.artistId,
        album: CATALOG.pink_floyd_time.album,
        albumId: CATALOG.pink_floyd_time.albumId,
        duration: CATALOG.pink_floyd_time.duration,
        albumImageUrl: CATALOG.pink_floyd_time.albumImageUrl,
      },
      {
        id: "sl-11",
        timeStr: "22:51",
        title: CATALOG.pink_floyd_money.name,
        artist: CATALOG.pink_floyd_money.artist,
        artistId: CATALOG.pink_floyd_money.artistId,
        album: CATALOG.pink_floyd_money.album,
        albumId: CATALOG.pink_floyd_money.albumId,
        duration: CATALOG.pink_floyd_money.duration,
        albumImageUrl: CATALOG.pink_floyd_money.albumImageUrl,
      },
      {
        id: "sl-12",
        timeStr: "22:45",
        title: CATALOG.daft_punk_get_lucky.name,
        artist: CATALOG.daft_punk_get_lucky.artist,
        artistId: CATALOG.daft_punk_get_lucky.artistId,
        album: CATALOG.daft_punk_get_lucky.album,
        albumId: CATALOG.daft_punk_get_lucky.albumId,
        duration: CATALOG.daft_punk_get_lucky.duration,
        albumImageUrl: CATALOG.daft_punk_get_lucky.albumImageUrl,
      },
      {
        id: "sl-13",
        timeStr: "22:39",
        title: CATALOG.daft_punk_instant_crush.name,
        artist: CATALOG.daft_punk_instant_crush.artist,
        artistId: CATALOG.daft_punk_instant_crush.artistId,
        album: CATALOG.daft_punk_instant_crush.album,
        albumId: CATALOG.daft_punk_instant_crush.albumId,
        duration: CATALOG.daft_punk_instant_crush.duration,
        albumImageUrl: CATALOG.daft_punk_instant_crush.albumImageUrl,
      },
      {
        id: "sl-14",
        timeStr: "22:35",
        title: CATALOG.beatles_come_together.name,
        artist: CATALOG.beatles_come_together.artist,
        artistId: CATALOG.beatles_come_together.artistId,
        album: CATALOG.beatles_come_together.album,
        albumId: CATALOG.beatles_come_together.albumId,
        duration: CATALOG.beatles_come_together.duration,
        albumImageUrl: CATALOG.beatles_come_together.albumImageUrl,
      },
      {
        id: "sl-15",
        timeStr: "22:31",
        title: CATALOG.beatles_here_comes_the_sun.name,
        artist: CATALOG.beatles_here_comes_the_sun.artist,
        artistId: CATALOG.beatles_here_comes_the_sun.artistId,
        album: CATALOG.beatles_here_comes_the_sun.album,
        albumId: CATALOG.beatles_here_comes_the_sun.albumId,
        duration: CATALOG.beatles_here_comes_the_sun.duration,
        albumImageUrl: CATALOG.beatles_here_comes_the_sun.albumImageUrl,
      },
      {
        id: "sl-16",
        timeStr: "22:27",
        title: CATALOG.taylor_swift_cardigan.name,
        artist: CATALOG.taylor_swift_cardigan.artist,
        artistId: CATALOG.taylor_swift_cardigan.artistId,
        album: CATALOG.taylor_swift_cardigan.album,
        albumId: CATALOG.taylor_swift_cardigan.albumId,
        duration: CATALOG.taylor_swift_cardigan.duration,
        albumImageUrl: CATALOG.taylor_swift_cardigan.albumImageUrl,
      },
      {
        id: "sl-17",
        timeStr: "22:22",
        title: CATALOG.taylor_swift_exile.name,
        artist: CATALOG.taylor_swift_exile.artist,
        artistId: CATALOG.taylor_swift_exile.artistId,
        album: CATALOG.taylor_swift_exile.album,
        albumId: CATALOG.taylor_swift_exile.albumId,
        duration: CATALOG.taylor_swift_exile.duration,
        albumImageUrl: CATALOG.taylor_swift_exile.albumImageUrl,
      },
      {
        id: "sl-18",
        timeStr: "22:18",
        title: CATALOG.billie_eilish_bad_guy.name,
        artist: CATALOG.billie_eilish_bad_guy.artist,
        artistId: CATALOG.billie_eilish_bad_guy.artistId,
        album: CATALOG.billie_eilish_bad_guy.album,
        albumId: CATALOG.billie_eilish_bad_guy.albumId,
        duration: CATALOG.billie_eilish_bad_guy.duration,
        albumImageUrl: CATALOG.billie_eilish_bad_guy.albumImageUrl,
      },

      // Session Gap separating today's afternoon listening from evening
      {
        id: "sl-19",
        timeStr: "17:42",
        title: CATALOG.arctic_monkeys_do_i_wanna_know.name,
        artist: CATALOG.arctic_monkeys_do_i_wanna_know.artist,
        artistId: CATALOG.arctic_monkeys_do_i_wanna_know.artistId,
        album: CATALOG.arctic_monkeys_do_i_wanna_know.album,
        albumId: CATALOG.arctic_monkeys_do_i_wanna_know.albumId,
        duration: CATALOG.arctic_monkeys_do_i_wanna_know.duration,
        albumImageUrl: CATALOG.arctic_monkeys_do_i_wanna_know.albumImageUrl,
        sessionGap: {
          durationStr: "4h 36m",
          sittingLabel: "SITTING 02",
        },
      },
      {
        id: "sl-20",
        timeStr: "17:37",
        title: CATALOG.beach_house_space_song.name,
        artist: CATALOG.beach_house_space_song.artist,
        artistId: CATALOG.beach_house_space_song.artistId,
        album: CATALOG.beach_house_space_song.album,
        albumId: CATALOG.beach_house_space_song.albumId,
        duration: CATALOG.beach_house_space_song.duration,
        albumImageUrl: CATALOG.beach_house_space_song.albumImageUrl,
      },
      {
        id: "sl-21",
        timeStr: "17:31",
        title: CATALOG.tame_impala_less_i_know.name,
        artist: CATALOG.tame_impala_less_i_know.artist,
        artistId: CATALOG.tame_impala_less_i_know.artistId,
        album: CATALOG.tame_impala_less_i_know.album,
        albumId: CATALOG.tame_impala_less_i_know.albumId,
        duration: CATALOG.tame_impala_less_i_know.duration,
        albumImageUrl: CATALOG.tame_impala_less_i_know.albumImageUrl,
      },
      {
        id: "sl-22",
        timeStr: "17:25",
        title: CATALOG.radiohead_nude.name,
        artist: CATALOG.radiohead_nude.artist,
        artistId: CATALOG.radiohead_nude.artistId,
        album: CATALOG.radiohead_nude.album,
        albumId: CATALOG.radiohead_nude.albumId,
        duration: CATALOG.radiohead_nude.duration,
        albumImageUrl: CATALOG.radiohead_nude.albumImageUrl,
      },

      // Day Group: 08 SEP (Yesterday)
      {
        id: "sl-23",
        timeStr: "21:50",
        title: CATALOG.nirvana_teen_spirit.name,
        artist: CATALOG.nirvana_teen_spirit.artist,
        artistId: CATALOG.nirvana_teen_spirit.artistId,
        album: CATALOG.nirvana_teen_spirit.album,
        albumId: CATALOG.nirvana_teen_spirit.albumId,
        duration: CATALOG.nirvana_teen_spirit.duration,
        albumImageUrl: CATALOG.nirvana_teen_spirit.albumImageUrl,
        dayGroup: "08 SEP",
      },
      {
        id: "sl-24",
        timeStr: "21:44",
        title: CATALOG.david_bowie_heroes.name,
        artist: CATALOG.david_bowie_heroes.artist,
        artistId: CATALOG.david_bowie_heroes.artistId,
        album: CATALOG.david_bowie_heroes.album,
        albumId: CATALOG.david_bowie_heroes.albumId,
        duration: CATALOG.david_bowie_heroes.duration,
        albumImageUrl: CATALOG.david_bowie_heroes.albumImageUrl,
      },
      {
        id: "sl-25",
        timeStr: "21:38",
        title: CATALOG.michael_jackson_billie_jean.name,
        artist: CATALOG.michael_jackson_billie_jean.artist,
        artistId: CATALOG.michael_jackson_billie_jean.artistId,
        album: CATALOG.michael_jackson_billie_jean.album,
        albumId: CATALOG.michael_jackson_billie_jean.albumId,
        duration: CATALOG.michael_jackson_billie_jean.duration,
        albumImageUrl: CATALOG.michael_jackson_billie_jean.albumImageUrl,
      },
      {
        id: "sl-26",
        timeStr: "21:32",
        title: CATALOG.queen_bohemian_rhapsody.name,
        artist: CATALOG.queen_bohemian_rhapsody.artist,
        artistId: CATALOG.queen_bohemian_rhapsody.artistId,
        album: CATALOG.queen_bohemian_rhapsody.album,
        albumId: CATALOG.queen_bohemian_rhapsody.albumId,
        duration: CATALOG.queen_bohemian_rhapsody.duration,
        albumImageUrl: CATALOG.queen_bohemian_rhapsody.albumImageUrl,
      },
      {
        id: "sl-27",
        timeStr: "21:26",
        title: CATALOG.lorde_ribs.name,
        artist: CATALOG.lorde_ribs.artist,
        artistId: CATALOG.lorde_ribs.artistId,
        album: CATALOG.lorde_ribs.album,
        albumId: CATALOG.lorde_ribs.albumId,
        duration: CATALOG.lorde_ribs.duration,
        albumImageUrl: CATALOG.lorde_ribs.albumImageUrl,
      },
      {
        id: "sl-28",
        timeStr: "21:21",
        title: CATALOG.beach_boys_god_only_knows.name,
        artist: CATALOG.beach_boys_god_only_knows.artist,
        artistId: CATALOG.beach_boys_god_only_knows.artistId,
        album: CATALOG.beach_boys_god_only_knows.album,
        albumId: CATALOG.beach_boys_god_only_knows.albumId,
        duration: CATALOG.beach_boys_god_only_knows.duration,
        albumImageUrl: CATALOG.beach_boys_god_only_knows.albumImageUrl,
      },
      {
        id: "sl-29",
        timeStr: "21:13",
        title: CATALOG.led_zeppelin_stairway.name,
        artist: CATALOG.led_zeppelin_stairway.artist,
        artistId: CATALOG.led_zeppelin_stairway.artistId,
        album: CATALOG.led_zeppelin_stairway.album,
        albumId: CATALOG.led_zeppelin_stairway.albumId,
        duration: CATALOG.led_zeppelin_stairway.duration,
        albumImageUrl: CATALOG.led_zeppelin_stairway.albumImageUrl,
      },
      {
        id: "sl-30",
        timeStr: "21:07",
        title: CATALOG.radiohead_paranoid_android.name,
        artist: CATALOG.radiohead_paranoid_android.artist,
        artistId: CATALOG.radiohead_paranoid_android.artistId,
        album: CATALOG.radiohead_paranoid_android.album,
        albumId: CATALOG.radiohead_paranoid_android.albumId,
        duration: CATALOG.radiohead_paranoid_android.duration,
        albumImageUrl: CATALOG.radiohead_paranoid_android.albumImageUrl,
      },
      {
        id: "sl-31",
        timeStr: "21:02",
        title: CATALOG.radiohead_karma_police.name,
        artist: CATALOG.radiohead_karma_police.artist,
        artistId: CATALOG.radiohead_karma_police.artistId,
        album: CATALOG.radiohead_karma_police.album,
        albumId: CATALOG.radiohead_karma_police.albumId,
        duration: CATALOG.radiohead_karma_police.duration,
        albumImageUrl: CATALOG.radiohead_karma_police.albumImageUrl,
      },
      {
        id: "sl-32",
        timeStr: "20:56",
        title: CATALOG.frank_ocean_nikes.name,
        artist: CATALOG.frank_ocean_nikes.artist,
        artistId: CATALOG.frank_ocean_nikes.artistId,
        album: CATALOG.frank_ocean_nikes.album,
        albumId: CATALOG.frank_ocean_nikes.albumId,
        duration: CATALOG.frank_ocean_nikes.duration,
        albumImageUrl: CATALOG.frank_ocean_nikes.albumImageUrl,
      },
      {
        id: "sl-33",
        timeStr: "20:51",
        title: CATALOG.frank_ocean_nights.name,
        artist: CATALOG.frank_ocean_nights.artist,
        artistId: CATALOG.frank_ocean_nights.artistId,
        album: CATALOG.frank_ocean_nights.album,
        albumId: CATALOG.frank_ocean_nights.albumId,
        duration: CATALOG.frank_ocean_nights.duration,
        albumImageUrl: CATALOG.frank_ocean_nights.albumImageUrl,
      },
      {
        id: "sl-34",
        timeStr: "20:47",
        title: CATALOG.kendrick_king_kunta.name,
        artist: CATALOG.kendrick_king_kunta.artist,
        artistId: CATALOG.kendrick_king_kunta.artistId,
        album: CATALOG.kendrick_king_kunta.album,
        albumId: CATALOG.kendrick_king_kunta.albumId,
        duration: CATALOG.kendrick_king_kunta.duration,
        albumImageUrl: CATALOG.kendrick_king_kunta.albumImageUrl,
      },
      {
        id: "sl-35",
        timeStr: "20:41",
        title: CATALOG.kendrick_money_trees.name,
        artist: CATALOG.kendrick_money_trees.artist,
        artistId: CATALOG.kendrick_money_trees.artistId,
        album: CATALOG.kendrick_money_trees.album,
        albumId: CATALOG.kendrick_money_trees.albumId,
        duration: CATALOG.kendrick_money_trees.duration,
        albumImageUrl: CATALOG.kendrick_money_trees.albumImageUrl,
      },
      {
        id: "sl-36",
        timeStr: "20:37",
        title: CATALOG.phoebe_motion_sickness.name,
        artist: CATALOG.phoebe_motion_sickness.artist,
        artistId: CATALOG.phoebe_motion_sickness.artistId,
        album: CATALOG.phoebe_motion_sickness.album,
        albumId: CATALOG.phoebe_motion_sickness.albumId,
        duration: CATALOG.phoebe_motion_sickness.duration,
        albumImageUrl: CATALOG.phoebe_motion_sickness.albumImageUrl,
      },
      {
        id: "sl-37",
        timeStr: "20:31",
        title: CATALOG.fleetwood_dreams.name,
        artist: CATALOG.fleetwood_dreams.artist,
        artistId: CATALOG.fleetwood_dreams.artistId,
        album: CATALOG.fleetwood_dreams.album,
        albumId: CATALOG.fleetwood_dreams.albumId,
        duration: CATALOG.fleetwood_dreams.duration,
        albumImageUrl: CATALOG.fleetwood_dreams.albumImageUrl,
      },
      {
        id: "sl-38",
        timeStr: "20:25",
        title: CATALOG.pink_floyd_time.name,
        artist: CATALOG.pink_floyd_time.artist,
        artistId: CATALOG.pink_floyd_time.artistId,
        album: CATALOG.pink_floyd_time.album,
        albumId: CATALOG.pink_floyd_time.albumId,
        duration: CATALOG.pink_floyd_time.duration,
        albumImageUrl: CATALOG.pink_floyd_time.albumImageUrl,
      },
      {
        id: "sl-39",
        timeStr: "20:19",
        title: CATALOG.daft_punk_get_lucky.name,
        artist: CATALOG.daft_punk_get_lucky.artist,
        artistId: CATALOG.daft_punk_get_lucky.artistId,
        album: CATALOG.daft_punk_get_lucky.album,
        albumId: CATALOG.daft_punk_get_lucky.albumId,
        duration: CATALOG.daft_punk_get_lucky.duration,
        albumImageUrl: CATALOG.daft_punk_get_lucky.albumImageUrl,
      },
      {
        id: "sl-40",
        timeStr: "20:15",
        title: CATALOG.beatles_come_together.name,
        artist: CATALOG.beatles_come_together.artist,
        artistId: CATALOG.beatles_come_together.artistId,
        album: CATALOG.beatles_come_together.album,
        albumId: CATALOG.beatles_come_together.albumId,
        duration: CATALOG.beatles_come_together.duration,
        albumImageUrl: CATALOG.beatles_come_together.albumImageUrl,
      },

      // Day Group: 07 SEP
      {
        id: "sl-41",
        timeStr: "19:40",
        title: CATALOG.radiohead_weird_fishes.name,
        artist: CATALOG.radiohead_weird_fishes.artist,
        artistId: CATALOG.radiohead_weird_fishes.artistId,
        album: CATALOG.radiohead_weird_fishes.album,
        albumId: CATALOG.radiohead_weird_fishes.albumId,
        duration: CATALOG.radiohead_weird_fishes.duration,
        albumImageUrl: CATALOG.radiohead_weird_fishes.albumImageUrl,
        dayGroup: "07 SEP",
        sessionGap: {
          durationStr: "24h 35m",
          sittingLabel: "SITTING 01",
        },
      },
      {
        id: "sl-42",
        timeStr: "19:35",
        title: CATALOG.radiohead_reckoner.name,
        artist: CATALOG.radiohead_reckoner.artist,
        artistId: CATALOG.radiohead_reckoner.artistId,
        album: CATALOG.radiohead_reckoner.album,
        albumId: CATALOG.radiohead_reckoner.albumId,
        duration: CATALOG.radiohead_reckoner.duration,
        albumImageUrl: CATALOG.radiohead_reckoner.albumImageUrl,
      },
      {
        id: "sl-43",
        timeStr: "19:30",
        title: CATALOG.frank_ocean_pink_white.name,
        artist: CATALOG.frank_ocean_pink_white.artist,
        artistId: CATALOG.frank_ocean_pink_white.artistId,
        album: CATALOG.frank_ocean_pink_white.album,
        albumId: CATALOG.frank_ocean_pink_white.albumId,
        duration: CATALOG.frank_ocean_pink_white.duration,
        albumImageUrl: CATALOG.frank_ocean_pink_white.albumImageUrl,
      },
      {
        id: "sl-44",
        timeStr: "19:26",
        title: CATALOG.frank_ocean_ivy.name,
        artist: CATALOG.frank_ocean_ivy.artist,
        artistId: CATALOG.frank_ocean_ivy.artistId,
        album: CATALOG.frank_ocean_ivy.album,
        albumId: CATALOG.frank_ocean_ivy.albumId,
        duration: CATALOG.frank_ocean_ivy.duration,
        albumImageUrl: CATALOG.frank_ocean_ivy.albumImageUrl,
      },
      {
        id: "sl-45",
        timeStr: "19:21",
        title: CATALOG.kendrick_alright.name,
        artist: CATALOG.kendrick_alright.artist,
        artistId: CATALOG.kendrick_alright.artistId,
        album: CATALOG.kendrick_alright.album,
        albumId: CATALOG.kendrick_alright.albumId,
        duration: CATALOG.kendrick_alright.duration,
        albumImageUrl: CATALOG.kendrick_alright.albumImageUrl,
      },
      {
        id: "sl-46",
        timeStr: "19:17",
        title: CATALOG.phoebe_kyoto.name,
        artist: CATALOG.phoebe_kyoto.artist,
        artistId: CATALOG.phoebe_kyoto.artistId,
        album: CATALOG.phoebe_kyoto.album,
        albumId: CATALOG.phoebe_kyoto.albumId,
        duration: CATALOG.phoebe_kyoto.duration,
        albumImageUrl: CATALOG.phoebe_kyoto.albumImageUrl,
      },
      {
        id: "sl-47",
        timeStr: "19:11",
        title: CATALOG.fleetwood_the_chain.name,
        artist: CATALOG.fleetwood_the_chain.artist,
        artistId: CATALOG.fleetwood_the_chain.artistId,
        album: CATALOG.fleetwood_the_chain.album,
        albumId: CATALOG.fleetwood_the_chain.albumId,
        duration: CATALOG.fleetwood_the_chain.duration,
        albumImageUrl: CATALOG.fleetwood_the_chain.albumImageUrl,
      },
      {
        id: "sl-48",
        timeStr: "19:04",
        title: CATALOG.pink_floyd_time.name,
        artist: CATALOG.pink_floyd_time.artist,
        artistId: CATALOG.pink_floyd_time.artistId,
        album: CATALOG.pink_floyd_time.album,
        albumId: CATALOG.pink_floyd_time.albumId,
        duration: CATALOG.pink_floyd_time.duration,
        albumImageUrl: CATALOG.pink_floyd_time.albumImageUrl,
      },
      {
        id: "sl-49",
        timeStr: "18:58",
        title: CATALOG.daft_punk_get_lucky.name,
        artist: CATALOG.daft_punk_get_lucky.artist,
        artistId: CATALOG.daft_punk_get_lucky.artistId,
        album: CATALOG.daft_punk_get_lucky.album,
        albumId: CATALOG.daft_punk_get_lucky.albumId,
        duration: CATALOG.daft_punk_get_lucky.duration,
        albumImageUrl: CATALOG.daft_punk_get_lucky.albumImageUrl,
      },
      {
        id: "sl-50",
        timeStr: "18:54",
        title: CATALOG.beatles_here_comes_the_sun.name,
        artist: CATALOG.beatles_here_comes_the_sun.artist,
        artistId: CATALOG.beatles_here_comes_the_sun.artistId,
        album: CATALOG.beatles_here_comes_the_sun.album,
        albumId: CATALOG.beatles_here_comes_the_sun.albumId,
        duration: CATALOG.beatles_here_comes_the_sun.duration,
        albumImageUrl: CATALOG.beatles_here_comes_the_sun.albumImageUrl,
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Mode 2: Session View (20 Previous Sittings, Active Sitting, Full Sittings)
  // -------------------------------------------------------------------------
  session: {
    isOpen: false,
    tagTime: "18M",
    metrics: ["1h 14m", "18", "6", "22:18"],
    sittingTracks: [
      {
        id: CATALOG.radiohead_weird_fishes.id,
        timestamp: "23:44",
        title: CATALOG.radiohead_weird_fishes.name,
        artist: CATALOG.radiohead_weird_fishes.artist,
        artistId: CATALOG.radiohead_weird_fishes.artistId,
        album: CATALOG.radiohead_weird_fishes.album,
        albumId: CATALOG.radiohead_weird_fishes.albumId,
        swatchColor: CATALOG.radiohead_weird_fishes.swatchColor,
        albumImageUrl: CATALOG.radiohead_weird_fishes.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.radiohead_weird_fishes.duration,
      },
      {
        id: CATALOG.radiohead_15_step.id,
        timestamp: "23:38",
        title: CATALOG.radiohead_15_step.name,
        artist: CATALOG.radiohead_15_step.artist,
        artistId: CATALOG.radiohead_15_step.artistId,
        album: CATALOG.radiohead_15_step.album,
        albumId: CATALOG.radiohead_15_step.albumId,
        swatchColor: CATALOG.radiohead_15_step.swatchColor,
        albumImageUrl: CATALOG.radiohead_15_step.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.radiohead_15_step.duration,
      },
      {
        id: CATALOG.frank_ocean_pink_white.id,
        timestamp: "23:34",
        title: CATALOG.frank_ocean_pink_white.name,
        artist: CATALOG.frank_ocean_pink_white.artist,
        artistId: CATALOG.frank_ocean_pink_white.artistId,
        album: CATALOG.frank_ocean_pink_white.album,
        albumId: CATALOG.frank_ocean_pink_white.albumId,
        swatchColor: CATALOG.frank_ocean_pink_white.swatchColor,
        albumImageUrl: CATALOG.frank_ocean_pink_white.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.frank_ocean_pink_white.duration,
      },
      {
        id: CATALOG.frank_ocean_ivy.id,
        timestamp: "23:29",
        title: CATALOG.frank_ocean_ivy.name,
        artist: CATALOG.frank_ocean_ivy.artist,
        artistId: CATALOG.frank_ocean_ivy.artistId,
        album: CATALOG.frank_ocean_ivy.album,
        albumId: CATALOG.frank_ocean_ivy.albumId,
        swatchColor: CATALOG.frank_ocean_ivy.swatchColor,
        albumImageUrl: CATALOG.frank_ocean_ivy.albumImageUrl,
        isFirstPlay: true,
        duration: CATALOG.frank_ocean_ivy.duration,
      },
      {
        id: CATALOG.kendrick_alright.id,
        timestamp: "23:24",
        title: CATALOG.kendrick_alright.name,
        artist: CATALOG.kendrick_alright.artist,
        artistId: CATALOG.kendrick_alright.artistId,
        album: CATALOG.kendrick_alright.album,
        albumId: CATALOG.kendrick_alright.albumId,
        swatchColor: CATALOG.kendrick_alright.swatchColor,
        albumImageUrl: CATALOG.kendrick_alright.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.kendrick_alright.duration,
      },
      {
        id: CATALOG.phoebe_kyoto.id,
        timestamp: "23:20",
        title: CATALOG.phoebe_kyoto.name,
        artist: CATALOG.phoebe_kyoto.artist,
        artistId: CATALOG.phoebe_kyoto.artistId,
        album: CATALOG.phoebe_kyoto.album,
        albumId: CATALOG.phoebe_kyoto.albumId,
        swatchColor: CATALOG.phoebe_kyoto.swatchColor,
        albumImageUrl: CATALOG.phoebe_kyoto.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.phoebe_kyoto.duration,
      },
      {
        id: CATALOG.phoebe_i_know_the_end.id,
        timestamp: "23:14",
        title: CATALOG.phoebe_i_know_the_end.name,
        artist: CATALOG.phoebe_i_know_the_end.artist,
        artistId: CATALOG.phoebe_i_know_the_end.artistId,
        album: CATALOG.phoebe_i_know_the_end.album,
        albumId: CATALOG.phoebe_i_know_the_end.albumId,
        swatchColor: CATALOG.phoebe_i_know_the_end.swatchColor,
        albumImageUrl: CATALOG.phoebe_i_know_the_end.albumImageUrl,
        isFirstPlay: true,
        duration: CATALOG.phoebe_i_know_the_end.duration,
      },
      {
        id: CATALOG.fleetwood_dreams.id,
        timestamp: "23:09",
        title: CATALOG.fleetwood_dreams.name,
        artist: CATALOG.fleetwood_dreams.artist,
        artistId: CATALOG.fleetwood_dreams.artistId,
        album: CATALOG.fleetwood_dreams.album,
        albumId: CATALOG.fleetwood_dreams.albumId,
        swatchColor: CATALOG.fleetwood_dreams.swatchColor,
        albumImageUrl: CATALOG.fleetwood_dreams.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.fleetwood_dreams.duration,
      },
      {
        id: CATALOG.fleetwood_the_chain.id,
        timestamp: "23:04",
        title: CATALOG.fleetwood_the_chain.name,
        artist: CATALOG.fleetwood_the_chain.artist,
        artistId: CATALOG.fleetwood_the_chain.artistId,
        album: CATALOG.fleetwood_the_chain.album,
        albumId: CATALOG.fleetwood_the_chain.albumId,
        swatchColor: CATALOG.fleetwood_the_chain.swatchColor,
        albumImageUrl: CATALOG.fleetwood_the_chain.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.fleetwood_the_chain.duration,
      },
      {
        id: CATALOG.pink_floyd_time.id,
        timestamp: "22:58",
        title: CATALOG.pink_floyd_time.name,
        artist: CATALOG.pink_floyd_time.artist,
        artistId: CATALOG.pink_floyd_time.artistId,
        album: CATALOG.pink_floyd_time.album,
        albumId: CATALOG.pink_floyd_time.albumId,
        swatchColor: CATALOG.pink_floyd_time.swatchColor,
        albumImageUrl: CATALOG.pink_floyd_time.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.pink_floyd_time.duration,
      },
      {
        id: CATALOG.pink_floyd_money.id,
        timestamp: "22:51",
        title: CATALOG.pink_floyd_money.name,
        artist: CATALOG.pink_floyd_money.artist,
        artistId: CATALOG.pink_floyd_money.artistId,
        album: CATALOG.pink_floyd_money.album,
        albumId: CATALOG.pink_floyd_money.albumId,
        swatchColor: CATALOG.pink_floyd_money.swatchColor,
        albumImageUrl: CATALOG.pink_floyd_money.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.pink_floyd_money.duration,
      },
      {
        id: CATALOG.daft_punk_get_lucky.id,
        timestamp: "22:45",
        title: CATALOG.daft_punk_get_lucky.name,
        artist: CATALOG.daft_punk_get_lucky.artist,
        artistId: CATALOG.daft_punk_get_lucky.artistId,
        album: CATALOG.daft_punk_get_lucky.album,
        albumId: CATALOG.daft_punk_get_lucky.albumId,
        swatchColor: CATALOG.daft_punk_get_lucky.swatchColor,
        albumImageUrl: CATALOG.daft_punk_get_lucky.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.daft_punk_get_lucky.duration,
      },
      {
        id: CATALOG.daft_punk_instant_crush.id,
        timestamp: "22:39",
        title: CATALOG.daft_punk_instant_crush.name,
        artist: CATALOG.daft_punk_instant_crush.artist,
        artistId: CATALOG.daft_punk_instant_crush.artistId,
        album: CATALOG.daft_punk_instant_crush.album,
        albumId: CATALOG.daft_punk_instant_crush.albumId,
        swatchColor: CATALOG.daft_punk_instant_crush.swatchColor,
        albumImageUrl: CATALOG.daft_punk_instant_crush.albumImageUrl,
        isFirstPlay: true,
        duration: CATALOG.daft_punk_instant_crush.duration,
      },
      {
        id: CATALOG.beatles_come_together.id,
        timestamp: "22:35",
        title: CATALOG.beatles_come_together.name,
        artist: CATALOG.beatles_come_together.artist,
        artistId: CATALOG.beatles_come_together.artistId,
        album: CATALOG.beatles_come_together.album,
        albumId: CATALOG.beatles_come_together.albumId,
        swatchColor: CATALOG.beatles_come_together.swatchColor,
        albumImageUrl: CATALOG.beatles_come_together.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.beatles_come_together.duration,
      },
      {
        id: CATALOG.beatles_here_comes_the_sun.id,
        timestamp: "22:31",
        title: CATALOG.beatles_here_comes_the_sun.name,
        artist: CATALOG.beatles_here_comes_the_sun.artist,
        artistId: CATALOG.beatles_here_comes_the_sun.artistId,
        album: CATALOG.beatles_here_comes_the_sun.album,
        albumId: CATALOG.beatles_here_comes_the_sun.albumId,
        swatchColor: CATALOG.beatles_here_comes_the_sun.swatchColor,
        albumImageUrl: CATALOG.beatles_here_comes_the_sun.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.beatles_here_comes_the_sun.duration,
      },
      {
        id: CATALOG.taylor_swift_cardigan.id,
        timestamp: "22:27",
        title: CATALOG.taylor_swift_cardigan.name,
        artist: CATALOG.taylor_swift_cardigan.artist,
        artistId: CATALOG.taylor_swift_cardigan.artistId,
        album: CATALOG.taylor_swift_cardigan.album,
        albumId: CATALOG.taylor_swift_cardigan.albumId,
        swatchColor: CATALOG.taylor_swift_cardigan.swatchColor,
        albumImageUrl: CATALOG.taylor_swift_cardigan.albumImageUrl,
        isFirstPlay: true,
        duration: CATALOG.taylor_swift_cardigan.duration,
      },
      {
        id: CATALOG.taylor_swift_exile.id,
        timestamp: "22:22",
        title: CATALOG.taylor_swift_exile.name,
        artist: CATALOG.taylor_swift_exile.artist,
        artistId: CATALOG.taylor_swift_exile.artistId,
        album: CATALOG.taylor_swift_exile.album,
        albumId: CATALOG.taylor_swift_exile.albumId,
        swatchColor: CATALOG.taylor_swift_exile.swatchColor,
        albumImageUrl: CATALOG.taylor_swift_exile.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.taylor_swift_exile.duration,
      },
      {
        id: CATALOG.billie_eilish_bad_guy.id,
        timestamp: "22:18",
        title: CATALOG.billie_eilish_bad_guy.name,
        artist: CATALOG.billie_eilish_bad_guy.artist,
        artistId: CATALOG.billie_eilish_bad_guy.artistId,
        album: CATALOG.billie_eilish_bad_guy.album,
        albumId: CATALOG.billie_eilish_bad_guy.albumId,
        swatchColor: CATALOG.billie_eilish_bad_guy.swatchColor,
        albumImageUrl: CATALOG.billie_eilish_bad_guy.albumImageUrl,
        isFirstPlay: false,
        duration: CATALOG.billie_eilish_bad_guy.duration,
      },
    ],
    previousSittings: [
      { id: "s1", dateStr: "09 SEP", durationStr: "1h 14m", tracksCountStr: "18 tracks", runtimeMinutes: 74, trackCount: 18 },
      { id: "s2", dateStr: "09 SEP", durationStr: "28m", tracksCountStr: "4 tracks", runtimeMinutes: 28, trackCount: 4 },
      { id: "s3", dateStr: "08 SEP", durationStr: "1h 22m", tracksCountStr: "18 tracks", runtimeMinutes: 82, trackCount: 18 },
      { id: "s4", dateStr: "07 SEP", durationStr: "46m", tracksCountStr: "10 tracks", runtimeMinutes: 46, trackCount: 10 },
      { id: "s5", dateStr: "07 SEP", durationStr: "22m", tracksCountStr: "5 tracks", runtimeMinutes: 22, trackCount: 5 },
      { id: "s6", dateStr: "06 SEP", durationStr: "54m", tracksCountStr: "12 tracks", runtimeMinutes: 54, trackCount: 12 },
      { id: "s7", dateStr: "06 SEP", durationStr: "15m", tracksCountStr: "3 tracks", runtimeMinutes: 15, trackCount: 3 },
      { id: "s8", dateStr: "05 SEP", durationStr: "1h 05m", tracksCountStr: "15 tracks", runtimeMinutes: 65, trackCount: 15 },
      { id: "s9", dateStr: "05 SEP", durationStr: "32m", tracksCountStr: "7 tracks", runtimeMinutes: 32, trackCount: 7 },
      { id: "s10", dateStr: "04 SEP", durationStr: "40m", tracksCountStr: "9 tracks", runtimeMinutes: 40, trackCount: 9 },
      { id: "s11", dateStr: "04 SEP", durationStr: "19m", tracksCountStr: "4 tracks", runtimeMinutes: 19, trackCount: 4 },
      { id: "s12", dateStr: "03 SEP", durationStr: "58m", tracksCountStr: "13 tracks", runtimeMinutes: 58, trackCount: 13 },
      { id: "s13", dateStr: "03 SEP", durationStr: "25m", tracksCountStr: "6 tracks", runtimeMinutes: 25, trackCount: 6 },
      { id: "s14", dateStr: "02 SEP", durationStr: "1h 18m", tracksCountStr: "19 tracks", runtimeMinutes: 78, trackCount: 19 },
      { id: "s15", dateStr: "01 SEP", durationStr: "35m", tracksCountStr: "8 tracks", runtimeMinutes: 35, trackCount: 8 },
      { id: "s16", dateStr: "01 SEP", durationStr: "12m", tracksCountStr: "2 tracks", runtimeMinutes: 12, trackCount: 2 },
      { id: "s17", dateStr: "31 AUG", durationStr: "48m", tracksCountStr: "11 tracks", runtimeMinutes: 48, trackCount: 11 },
      { id: "s18", dateStr: "30 AUG", durationStr: "1h 10m", tracksCountStr: "16 tracks", runtimeMinutes: 70, trackCount: 16 },
      { id: "s19", dateStr: "29 AUG", durationStr: "36m", tracksCountStr: "8 tracks", runtimeMinutes: 36, trackCount: 8 },
      { id: "s20", dateStr: "28 AUG", durationStr: "24m", tracksCountStr: "5 tracks", runtimeMinutes: 24, trackCount: 5 },
    ],
    histogram: {
      avgRuntimeMinutes: 44,
      oldestDate: "28 AUG",
      newestDate: "09 SEP",
      bars: [
        { id: "s20", runtimeMinutes: 24, dateStr: "28 AUG", title: "24m" },
        { id: "s19", runtimeMinutes: 36, dateStr: "29 AUG", title: "36m" },
        { id: "s18", runtimeMinutes: 70, dateStr: "30 AUG", title: "1h 10m" },
        { id: "s17", runtimeMinutes: 48, dateStr: "31 AUG", title: "48m" },
        { id: "s16", runtimeMinutes: 12, dateStr: "01 SEP", title: "12m" },
        { id: "s15", runtimeMinutes: 35, dateStr: "01 SEP", title: "35m" },
        { id: "s14", runtimeMinutes: 78, dateStr: "02 SEP", title: "1h 18m" },
        { id: "s13", runtimeMinutes: 25, dateStr: "03 SEP", title: "25m" },
        { id: "s12", runtimeMinutes: 58, dateStr: "03 SEP", title: "58m" },
        { id: "s11", runtimeMinutes: 19, dateStr: "04 SEP", title: "19m" },
        { id: "s10", runtimeMinutes: 40, dateStr: "04 SEP", title: "40m" },
        { id: "s9", runtimeMinutes: 32, dateStr: "05 SEP", title: "32m" },
        { id: "s8", runtimeMinutes: 65, dateStr: "05 SEP", title: "1h 05m" },
        { id: "s7", runtimeMinutes: 15, dateStr: "06 SEP", title: "15m" },
        { id: "s6", runtimeMinutes: 54, dateStr: "06 SEP", title: "54m" },
        { id: "s5", runtimeMinutes: 22, dateStr: "07 SEP", title: "22m" },
        { id: "s4", runtimeMinutes: 46, dateStr: "07 SEP", title: "46m" },
        { id: "s3", runtimeMinutes: 82, dateStr: "08 SEP", title: "1h 22m" },
        { id: "s2", runtimeMinutes: 28, dateStr: "09 SEP", title: "28m" },
        { id: "s1", runtimeMinutes: 74, dateStr: "09 SEP", title: "1h 14m" },
      ],
    },
    sittings: [
      {
            "id": "s1",
            "dateStr": "09 SEP",
            "runtimeMinutes": 74,
            "runtimeStr": "1h 14m",
            "trackCount": 18,
            "uniqueArtistsCount": 5,
            "startTime": "22:18",
            "tagTime": "18M",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "5e9TFT0nj3YegNVJE4uus4",
                        "timestamp": "23:28",
                        "title": "The Chain",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:30"
                  },
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "23:24",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:17"
                  },
                  {
                        "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
                        "timestamp": "23:20",
                        "title": "I Know The End",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:44"
                  },
                  {
                        "id": "5xo8RrjJ9CVNrtRg2S3tyW",
                        "timestamp": "23:16",
                        "title": "Motion Sickness",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Stranger in the Alps",
                        "albumId": "0AkFsgr2q1t75h8aV6uLpC",
                        "swatchColor": "#282A32",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:49"
                  },
                  {
                        "id": "49UDv3b5B1bQx4K43Q486h",
                        "timestamp": "23:11",
                        "title": "Kyoto",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:04"
                  },
                  {
                        "id": "74tLlkN3pmQwBvaMRA4oxE",
                        "timestamp": "23:07",
                        "title": "Money Trees",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "good kid, m.A.A.d city",
                        "albumId": "748dEZwhgnyspuaWIvlyx9",
                        "swatchColor": "#3D352E",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:26"
                  },
                  {
                        "id": "0N3W5qLeLqETRpyPheLGR5",
                        "timestamp": "23:03",
                        "title": "King Kunta",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:54"
                  },
                  {
                        "id": "3iVcQ50DCVupKAh0DxnZ1z",
                        "timestamp": "22:59",
                        "title": "Alright",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:39"
                  },
                  {
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "timestamp": "22:55",
                        "title": "Nights",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:07"
                  },
                  {
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "timestamp": "22:51",
                        "title": "Ivy",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:09"
                  },
                  {
                        "id": "19YKaevk2bce41UVk7RAum",
                        "timestamp": "22:47",
                        "title": "Nikes",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:14"
                  },
                  {
                        "id": "3xKsf9qdS1CyvXS5sb08b8",
                        "timestamp": "22:43",
                        "title": "Pink + White",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "63OQupATfueENZJaC0gNm1",
                        "timestamp": "22:39",
                        "title": "Karma Police",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:21"
                  },
                  {
                        "id": "6LgJvl0Xdtc73RJ1mmpotq",
                        "timestamp": "22:34",
                        "title": "Paranoid Android",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:23"
                  },
                  {
                        "id": "3zXh2r4hL4QhZ6qV6s0V8r",
                        "timestamp": "22:30",
                        "title": "Reckoner",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:50"
                  },
                  {
                        "id": "35YyxFtlUBloXIwtav7Ch5",
                        "timestamp": "22:26",
                        "title": "Nude",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:15"
                  },
                  {
                        "id": "4I2JA4Z53b01a14oH4pD2t",
                        "timestamp": "22:22",
                        "title": "15 Step",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:57"
                  },
                  {
                        "id": "4clD00s1c0rVqP9Ld0vV48",
                        "timestamp": "22:18",
                        "title": "Weird Fishes / Arpeggi",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:18"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 5,
                  "totalTracks": 18,
                  "topSong": {
                        "title": "The Chain",
                        "count": 1,
                        "id": "5e9TFT0nj3YegNVJE4uus4",
                        "artist": "Fleetwood Mac"
                  },
                  "topAlbum": {
                        "title": "Blonde",
                        "count": 4,
                        "id": "3mH6qwIy9crq0I9YQbOuDf",
                        "artist": "Frank Ocean"
                  },
                  "topArtist": {
                        "name": "Radiohead",
                        "count": 6,
                        "id": "4Z8W4fKeB5YxbusRsdQVPb"
                  }
            }
      },
      {
            "id": "s2",
            "dateStr": "09 SEP",
            "runtimeMinutes": 28,
            "runtimeStr": "28m",
            "trackCount": 4,
            "uniqueArtistsCount": 2,
            "startTime": "17:25",
            "tagTime": "6H",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "timestamp": "17:46",
                        "title": "Ivy",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:09"
                  },
                  {
                        "id": "19YKaevk2bce41UVk7RAum",
                        "timestamp": "17:39",
                        "title": "Nikes",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:14"
                  },
                  {
                        "id": "3xKsf9qdS1CyvXS5sb08b8",
                        "timestamp": "17:32",
                        "title": "Pink + White",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "63OQupATfueENZJaC0gNm1",
                        "timestamp": "17:25",
                        "title": "Karma Police",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:21"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 1,
                  "totalTracks": 4,
                  "topSong": {
                        "title": "Ivy",
                        "count": 1,
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "artist": "Frank Ocean"
                  },
                  "topAlbum": {
                        "title": "Blonde",
                        "count": 3,
                        "id": "3mH6qwIy9crq0I9YQbOuDf",
                        "artist": "Frank Ocean"
                  },
                  "topArtist": {
                        "name": "Frank Ocean",
                        "count": 3,
                        "id": "2h93pZq0e7k5yf4Y40u9UR"
                  }
            }
      },
      {
            "id": "s3",
            "dateStr": "08 SEP",
            "runtimeMinutes": 82,
            "runtimeStr": "1h 22m",
            "trackCount": 18,
            "uniqueArtistsCount": 9,
            "startTime": "20:15",
            "tagTime": "1D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "5FVbvFqU2sU5r0fI2b8Q7B",
                        "timestamp": "21:32",
                        "title": "Do I Wanna Know?",
                        "artist": "Arctic Monkeys",
                        "artistId": "7Ln80lUS6He07XvHI8qqHH",
                        "album": "AM",
                        "albumId": "78bpIziExqiI91ztvVJ5nR",
                        "swatchColor": "#1A1A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:32"
                  },
                  {
                        "id": "2Fxmhks0bxGSBdJ92v442m",
                        "timestamp": "21:28",
                        "title": "bad guy",
                        "artist": "Billie Eilish",
                        "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
                        "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
                        "albumId": "0S0KGZnfBGSI3F0irHgAC0",
                        "swatchColor": "#303028",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:14"
                  },
                  {
                        "id": "4pvb0WLRcMtbPGm22F8N0P",
                        "timestamp": "21:23",
                        "title": "exile (feat. Bon Iver)",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:45"
                  },
                  {
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "timestamp": "21:19",
                        "title": "cardigan",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:59"
                  },
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "21:14",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:05"
                  },
                  {
                        "id": "2EqlS6tkEnglzr77vAhx2b",
                        "timestamp": "21:10",
                        "title": "Come Together",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:19"
                  },
                  {
                        "id": "2cGxRwrMygjFu8KiMF1PFR",
                        "timestamp": "21:05",
                        "title": "Instant Crush",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:37"
                  },
                  {
                        "id": "2Foc5Q5nqNiosCNqttzHof",
                        "timestamp": "21:01",
                        "title": "Get Lucky",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:09"
                  },
                  {
                        "id": "0vFOzaXqCYFJvnudGii36Q",
                        "timestamp": "20:56",
                        "title": "Money",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:22"
                  },
                  {
                        "id": "3TO7mKlbtik89FRIYod0Ij",
                        "timestamp": "20:51",
                        "title": "Time",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:53"
                  },
                  {
                        "id": "5e9TFT0nj3YegNVJE4uus4",
                        "timestamp": "20:47",
                        "title": "The Chain",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:30"
                  },
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "20:42",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:17"
                  },
                  {
                        "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
                        "timestamp": "20:38",
                        "title": "I Know The End",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:44"
                  },
                  {
                        "id": "5xo8RrjJ9CVNrtRg2S3tyW",
                        "timestamp": "20:33",
                        "title": "Motion Sickness",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Stranger in the Alps",
                        "albumId": "0AkFsgr2q1t75h8aV6uLpC",
                        "swatchColor": "#282A32",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:49"
                  },
                  {
                        "id": "49UDv3b5B1bQx4K43Q486h",
                        "timestamp": "20:29",
                        "title": "Kyoto",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:04"
                  },
                  {
                        "id": "74tLlkN3pmQwBvaMRA4oxE",
                        "timestamp": "20:24",
                        "title": "Money Trees",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "good kid, m.A.A.d city",
                        "albumId": "748dEZwhgnyspuaWIvlyx9",
                        "swatchColor": "#3D352E",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:26"
                  },
                  {
                        "id": "0N3W5qLeLqETRpyPheLGR5",
                        "timestamp": "20:20",
                        "title": "King Kunta",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:54"
                  },
                  {
                        "id": "3iVcQ50DCVupKAh0DxnZ1z",
                        "timestamp": "20:15",
                        "title": "Alright",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:39"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 4,
                  "totalTracks": 18,
                  "topSong": {
                        "title": "Do I Wanna Know?",
                        "count": 1,
                        "id": "5FVbvFqU2sU5r0fI2b8Q7B",
                        "artist": "Arctic Monkeys"
                  },
                  "topAlbum": {
                        "title": "folklore",
                        "count": 2,
                        "id": "2fenSS68JI1h4Fo296JfGr",
                        "artist": "Taylor Swift"
                  },
                  "topArtist": {
                        "name": "Phoebe Bridgers",
                        "count": 3,
                        "id": "1r1uxoy19fzMxunt3ONAkG"
                  }
            }
      },
      {
            "id": "s4",
            "dateStr": "07 SEP",
            "runtimeMinutes": 46,
            "runtimeStr": "46m",
            "trackCount": 10,
            "uniqueArtistsCount": 6,
            "startTime": "18:54",
            "tagTime": "2D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "timestamp": "19:35",
                        "title": "cardigan",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:59"
                  },
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "19:31",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:05"
                  },
                  {
                        "id": "2EqlS6tkEnglzr77vAhx2b",
                        "timestamp": "19:26",
                        "title": "Come Together",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:19"
                  },
                  {
                        "id": "2cGxRwrMygjFu8KiMF1PFR",
                        "timestamp": "19:22",
                        "title": "Instant Crush",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:37"
                  },
                  {
                        "id": "2Foc5Q5nqNiosCNqttzHof",
                        "timestamp": "19:17",
                        "title": "Get Lucky",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:09"
                  },
                  {
                        "id": "0vFOzaXqCYFJvnudGii36Q",
                        "timestamp": "19:12",
                        "title": "Money",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:22"
                  },
                  {
                        "id": "3TO7mKlbtik89FRIYod0Ij",
                        "timestamp": "19:08",
                        "title": "Time",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:53"
                  },
                  {
                        "id": "5e9TFT0nj3YegNVJE4uus4",
                        "timestamp": "19:03",
                        "title": "The Chain",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:30"
                  },
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "18:59",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:17"
                  },
                  {
                        "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
                        "timestamp": "18:54",
                        "title": "I Know The End",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:44"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 2,
                  "totalTracks": 10,
                  "topSong": {
                        "title": "cardigan",
                        "count": 1,
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "artist": "Taylor Swift"
                  },
                  "topAlbum": {
                        "title": "Abbey Road",
                        "count": 2,
                        "id": "0ETFjACtuP2ADo6LFhL6HN",
                        "artist": "The Beatles"
                  },
                  "topArtist": {
                        "name": "The Beatles",
                        "count": 2,
                        "id": "3WrFJ7ztbogyGnTHbHJFl2"
                  }
            }
      },
      {
            "id": "s5",
            "dateStr": "07 SEP",
            "runtimeMinutes": 22,
            "runtimeStr": "22m",
            "trackCount": 5,
            "uniqueArtistsCount": 3,
            "startTime": "14:10",
            "tagTime": "2D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "timestamp": "14:28",
                        "title": "cardigan",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:59"
                  },
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "14:23",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:05"
                  },
                  {
                        "id": "2EqlS6tkEnglzr77vAhx2b",
                        "timestamp": "14:19",
                        "title": "Come Together",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:19"
                  },
                  {
                        "id": "2cGxRwrMygjFu8KiMF1PFR",
                        "timestamp": "14:14",
                        "title": "Instant Crush",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:37"
                  },
                  {
                        "id": "2Foc5Q5nqNiosCNqttzHof",
                        "timestamp": "14:10",
                        "title": "Get Lucky",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:09"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 1,
                  "totalTracks": 5,
                  "topSong": {
                        "title": "cardigan",
                        "count": 1,
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "artist": "Taylor Swift"
                  },
                  "topAlbum": {
                        "title": "Abbey Road",
                        "count": 2,
                        "id": "0ETFjACtuP2ADo6LFhL6HN",
                        "artist": "The Beatles"
                  },
                  "topArtist": {
                        "name": "The Beatles",
                        "count": 2,
                        "id": "3WrFJ7ztbogyGnTHbHJFl2"
                  }
            }
      },
      {
            "id": "s6",
            "dateStr": "06 SEP",
            "runtimeMinutes": 54,
            "runtimeStr": "54m",
            "trackCount": 12,
            "uniqueArtistsCount": 12,
            "startTime": "21:05",
            "tagTime": "3D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "5CQ30WqJwcep0pYcV4AMNc",
                        "timestamp": "21:55",
                        "title": "Stairway to Heaven",
                        "artist": "Led Zeppelin",
                        "artistId": "36QJfgBno56YwhRGFKX9Cr",
                        "album": "Led Zeppelin IV",
                        "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
                        "swatchColor": "#3D3528",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "8:02"
                  },
                  {
                        "id": "0z9jsZt7g2t7m4FqF32r8j",
                        "timestamp": "21:50",
                        "title": "God Only Knows",
                        "artist": "The Beach Boys",
                        "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
                        "album": "Pet Sounds",
                        "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
                        "swatchColor": "#2C3A24",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "2:53"
                  },
                  {
                        "id": "0TEekvbt0ZYRucMEC0roYI",
                        "timestamp": "21:46",
                        "title": "Ribs",
                        "artist": "Lorde",
                        "artistId": "163tK9Wjr9P9DmM0AVK7lm",
                        "album": "Pure Heroine",
                        "albumId": "0rmhj0uqT3lP906w3C0123",
                        "swatchColor": "#181818",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:18"
                  },
                  {
                        "id": "4u7EnebtmKWzUH433cf5Qv",
                        "timestamp": "21:41",
                        "title": "Bohemian Rhapsody",
                        "artist": "Queen",
                        "artistId": "1dfeR4HaWDbWqFssioeoL2",
                        "album": "A Night at the Opera",
                        "albumId": "1GbtB4zTqAsyfZEsm1RZSZ",
                        "swatchColor": "#282828",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:54"
                  },
                  {
                        "id": "5UbUbS5bU6xM5yYVqN6sZl",
                        "timestamp": "21:37",
                        "title": "Billie Jean",
                        "artist": "Michael Jackson",
                        "artistId": "3fMbdgg4jU18AjLCKBvRSm",
                        "album": "Thriller",
                        "albumId": "2noRn2Aes5aoQ6vUvt4mhu",
                        "swatchColor": "#352E2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:54"
                  },
                  {
                        "id": "72Z17vmmeQKAg8bptWvpVG",
                        "timestamp": "21:32",
                        "title": "\"Heroes\"",
                        "artist": "David Bowie",
                        "artistId": "0oSGxfWSnnOXhD2fKuz2Gy",
                        "album": "\"Heroes\"",
                        "albumId": "4I5zzKY1sp4neTeiU0W2Vw",
                        "swatchColor": "#2C2C2C",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:11"
                  },
                  {
                        "id": "5ghIWrUSR7jAjEY0rRI7np",
                        "timestamp": "21:28",
                        "title": "Smells Like Teen Spirit",
                        "artist": "Nirvana",
                        "artistId": "6olE6TJLqED3rqDCT0FyPh",
                        "album": "Nevermind",
                        "albumId": "2guIrUQVRq0VmsvBpJR297",
                        "swatchColor": "#1A3548",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:01"
                  },
                  {
                        "id": "6K4t31amVTZDgR3sKmwUJJ",
                        "timestamp": "21:23",
                        "title": "The Less I Know The Better",
                        "artist": "Tame Impala",
                        "artistId": "5INjqkS1o8h1imAzPqGZBb",
                        "album": "Currents",
                        "albumId": "79dL7FLiJFOO0EoehTaA1m",
                        "swatchColor": "#3F2B48",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:36"
                  },
                  {
                        "id": "7H0ya83CMmgFcOhw0UB6ow",
                        "timestamp": "21:19",
                        "title": "Space Song",
                        "artist": "Beach House",
                        "artistId": "56ZTgzPBDge0OvCGgMO3OY",
                        "album": "Depression Cherry",
                        "albumId": "7vK5a287L67hEw6pWbQvL8",
                        "swatchColor": "#4A1525",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:20"
                  },
                  {
                        "id": "5FVbvFqU2sU5r0fI2b8Q7B",
                        "timestamp": "21:14",
                        "title": "Do I Wanna Know?",
                        "artist": "Arctic Monkeys",
                        "artistId": "7Ln80lUS6He07XvHI8qqHH",
                        "album": "AM",
                        "albumId": "78bpIziExqiI91ztvVJ5nR",
                        "swatchColor": "#1A1A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:32"
                  },
                  {
                        "id": "2Fxmhks0bxGSBdJ92v442m",
                        "timestamp": "21:10",
                        "title": "bad guy",
                        "artist": "Billie Eilish",
                        "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
                        "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
                        "albumId": "0S0KGZnfBGSI3F0irHgAC0",
                        "swatchColor": "#303028",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:14"
                  },
                  {
                        "id": "4pvb0WLRcMtbPGm22F8N0P",
                        "timestamp": "21:05",
                        "title": "exile (feat. Bon Iver)",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:45"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 3,
                  "totalTracks": 12,
                  "topSong": {
                        "title": "Stairway to Heaven",
                        "count": 1,
                        "id": "5CQ30WqJwcep0pYcV4AMNc",
                        "artist": "Led Zeppelin"
                  },
                  "topAlbum": {
                        "title": "Led Zeppelin IV",
                        "count": 1,
                        "id": "5EyIDBAqhnAH9Kc4qvPpeq",
                        "artist": "Led Zeppelin"
                  },
                  "topArtist": {
                        "name": "Led Zeppelin",
                        "count": 1,
                        "id": "36QJfgBno56YwhRGFKX9Cr"
                  }
            }
      },
      {
            "id": "s7",
            "dateStr": "06 SEP",
            "runtimeMinutes": 15,
            "runtimeStr": "15m",
            "trackCount": 3,
            "uniqueArtistsCount": 3,
            "startTime": "16:40",
            "tagTime": "3D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "5UbUbS5bU6xM5yYVqN6sZl",
                        "timestamp": "16:50",
                        "title": "Billie Jean",
                        "artist": "Michael Jackson",
                        "artistId": "3fMbdgg4jU18AjLCKBvRSm",
                        "album": "Thriller",
                        "albumId": "2noRn2Aes5aoQ6vUvt4mhu",
                        "swatchColor": "#352E2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:54"
                  },
                  {
                        "id": "72Z17vmmeQKAg8bptWvpVG",
                        "timestamp": "16:45",
                        "title": "\"Heroes\"",
                        "artist": "David Bowie",
                        "artistId": "0oSGxfWSnnOXhD2fKuz2Gy",
                        "album": "\"Heroes\"",
                        "albumId": "4I5zzKY1sp4neTeiU0W2Vw",
                        "swatchColor": "#2C2C2C",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:11"
                  },
                  {
                        "id": "5ghIWrUSR7jAjEY0rRI7np",
                        "timestamp": "16:40",
                        "title": "Smells Like Teen Spirit",
                        "artist": "Nirvana",
                        "artistId": "6olE6TJLqED3rqDCT0FyPh",
                        "album": "Nevermind",
                        "albumId": "2guIrUQVRq0VmsvBpJR297",
                        "swatchColor": "#1A3548",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:01"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 0,
                  "totalTracks": 3,
                  "topSong": {
                        "title": "Billie Jean",
                        "count": 1,
                        "id": "5UbUbS5bU6xM5yYVqN6sZl",
                        "artist": "Michael Jackson"
                  },
                  "topAlbum": {
                        "title": "Thriller",
                        "count": 1,
                        "id": "2noRn2Aes5aoQ6vUvt4mhu",
                        "artist": "Michael Jackson"
                  },
                  "topArtist": {
                        "name": "Michael Jackson",
                        "count": 1,
                        "id": "3fMbdgg4jU18AjLCKBvRSm"
                  }
            }
      },
      {
            "id": "s8",
            "dateStr": "05 SEP",
            "runtimeMinutes": 65,
            "runtimeStr": "1h 05m",
            "trackCount": 15,
            "uniqueArtistsCount": 5,
            "startTime": "22:00",
            "tagTime": "4D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "74tLlkN3pmQwBvaMRA4oxE",
                        "timestamp": "23:01",
                        "title": "Money Trees",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "good kid, m.A.A.d city",
                        "albumId": "748dEZwhgnyspuaWIvlyx9",
                        "swatchColor": "#3D352E",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "6:26"
                  },
                  {
                        "id": "0N3W5qLeLqETRpyPheLGR5",
                        "timestamp": "22:56",
                        "title": "King Kunta",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:54"
                  },
                  {
                        "id": "3iVcQ50DCVupKAh0DxnZ1z",
                        "timestamp": "22:52",
                        "title": "Alright",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:39"
                  },
                  {
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "timestamp": "22:48",
                        "title": "Nights",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:07"
                  },
                  {
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "timestamp": "22:43",
                        "title": "Ivy",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:09"
                  },
                  {
                        "id": "19YKaevk2bce41UVk7RAum",
                        "timestamp": "22:39",
                        "title": "Nikes",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:14"
                  },
                  {
                        "id": "3xKsf9qdS1CyvXS5sb08b8",
                        "timestamp": "22:35",
                        "title": "Pink + White",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "63OQupATfueENZJaC0gNm1",
                        "timestamp": "22:30",
                        "title": "Karma Police",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:21"
                  },
                  {
                        "id": "6LgJvl0Xdtc73RJ1mmpotq",
                        "timestamp": "22:26",
                        "title": "Paranoid Android",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "6:23"
                  },
                  {
                        "id": "3zXh2r4hL4QhZ6qV6s0V8r",
                        "timestamp": "22:22",
                        "title": "Reckoner",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:50"
                  },
                  {
                        "id": "35YyxFtlUBloXIwtav7Ch5",
                        "timestamp": "22:17",
                        "title": "Nude",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:15"
                  },
                  {
                        "id": "4I2JA4Z53b01a14oH4pD2t",
                        "timestamp": "22:13",
                        "title": "15 Step",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:57"
                  },
                  {
                        "id": "4clD00s1c0rVqP9Ld0vV48",
                        "timestamp": "22:09",
                        "title": "Weird Fishes / Arpeggi",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:18"
                  },
                  {
                        "id": "5CQ30WqJwcep0pYcV4AMNc",
                        "timestamp": "22:04",
                        "title": "Stairway to Heaven",
                        "artist": "Led Zeppelin",
                        "artistId": "36QJfgBno56YwhRGFKX9Cr",
                        "album": "Led Zeppelin IV",
                        "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
                        "swatchColor": "#3D3528",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "8:02"
                  },
                  {
                        "id": "0z9jsZt7g2t7m4FqF32r8j",
                        "timestamp": "22:00",
                        "title": "God Only Knows",
                        "artist": "The Beach Boys",
                        "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
                        "album": "Pet Sounds",
                        "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
                        "swatchColor": "#2C3A24",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "2:53"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 4,
                  "totalTracks": 15,
                  "topSong": {
                        "title": "Money Trees",
                        "count": 1,
                        "id": "74tLlkN3pmQwBvaMRA4oxE",
                        "artist": "Kendrick Lamar"
                  },
                  "topAlbum": {
                        "title": "Blonde",
                        "count": 4,
                        "id": "3mH6qwIy9crq0I9YQbOuDf",
                        "artist": "Frank Ocean"
                  },
                  "topArtist": {
                        "name": "Radiohead",
                        "count": 6,
                        "id": "4Z8W4fKeB5YxbusRsdQVPb"
                  }
            }
      },
      {
            "id": "s9",
            "dateStr": "05 SEP",
            "runtimeMinutes": 32,
            "runtimeStr": "32m",
            "trackCount": 7,
            "uniqueArtistsCount": 2,
            "startTime": "13:20",
            "tagTime": "4D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "timestamp": "13:47",
                        "title": "Nights",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:07"
                  },
                  {
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "timestamp": "13:43",
                        "title": "Ivy",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:09"
                  },
                  {
                        "id": "19YKaevk2bce41UVk7RAum",
                        "timestamp": "13:38",
                        "title": "Nikes",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:14"
                  },
                  {
                        "id": "3xKsf9qdS1CyvXS5sb08b8",
                        "timestamp": "13:34",
                        "title": "Pink + White",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "63OQupATfueENZJaC0gNm1",
                        "timestamp": "13:29",
                        "title": "Karma Police",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:21"
                  },
                  {
                        "id": "6LgJvl0Xdtc73RJ1mmpotq",
                        "timestamp": "13:25",
                        "title": "Paranoid Android",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "6:23"
                  },
                  {
                        "id": "3zXh2r4hL4QhZ6qV6s0V8r",
                        "timestamp": "13:20",
                        "title": "Reckoner",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:50"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 2,
                  "totalTracks": 7,
                  "topSong": {
                        "title": "Nights",
                        "count": 1,
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "artist": "Frank Ocean"
                  },
                  "topAlbum": {
                        "title": "Blonde",
                        "count": 4,
                        "id": "3mH6qwIy9crq0I9YQbOuDf",
                        "artist": "Frank Ocean"
                  },
                  "topArtist": {
                        "name": "Frank Ocean",
                        "count": 4,
                        "id": "2h93pZq0e7k5yf4Y40u9UR"
                  }
            }
      },
      {
            "id": "s10",
            "dateStr": "04 SEP",
            "runtimeMinutes": 40,
            "runtimeStr": "40m",
            "trackCount": 9,
            "uniqueArtistsCount": 4,
            "startTime": "19:15",
            "tagTime": "5D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "19:51",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:17"
                  },
                  {
                        "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
                        "timestamp": "19:46",
                        "title": "I Know The End",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:44"
                  },
                  {
                        "id": "5xo8RrjJ9CVNrtRg2S3tyW",
                        "timestamp": "19:42",
                        "title": "Motion Sickness",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Stranger in the Alps",
                        "albumId": "0AkFsgr2q1t75h8aV6uLpC",
                        "swatchColor": "#282A32",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:49"
                  },
                  {
                        "id": "49UDv3b5B1bQx4K43Q486h",
                        "timestamp": "19:37",
                        "title": "Kyoto",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "74tLlkN3pmQwBvaMRA4oxE",
                        "timestamp": "19:33",
                        "title": "Money Trees",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "good kid, m.A.A.d city",
                        "albumId": "748dEZwhgnyspuaWIvlyx9",
                        "swatchColor": "#3D352E",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "6:26"
                  },
                  {
                        "id": "0N3W5qLeLqETRpyPheLGR5",
                        "timestamp": "19:28",
                        "title": "King Kunta",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:54"
                  },
                  {
                        "id": "3iVcQ50DCVupKAh0DxnZ1z",
                        "timestamp": "19:24",
                        "title": "Alright",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:39"
                  },
                  {
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "timestamp": "19:19",
                        "title": "Nights",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:07"
                  },
                  {
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "timestamp": "19:15",
                        "title": "Ivy",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:09"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 3,
                  "totalTracks": 9,
                  "topSong": {
                        "title": "Dreams",
                        "count": 1,
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "artist": "Fleetwood Mac"
                  },
                  "topAlbum": {
                        "title": "Punisher",
                        "count": 2,
                        "id": "2xGQEAlDAw7whm4vvt3WvX",
                        "artist": "Phoebe Bridgers"
                  },
                  "topArtist": {
                        "name": "Phoebe Bridgers",
                        "count": 3,
                        "id": "1r1uxoy19fzMxunt3ONAkG"
                  }
            }
      },
      {
            "id": "s11",
            "dateStr": "04 SEP",
            "runtimeMinutes": 19,
            "runtimeStr": "19m",
            "trackCount": 4,
            "uniqueArtistsCount": 2,
            "startTime": "11:30",
            "tagTime": "5D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "11:44",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:17"
                  },
                  {
                        "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
                        "timestamp": "11:40",
                        "title": "I Know The End",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:44"
                  },
                  {
                        "id": "5xo8RrjJ9CVNrtRg2S3tyW",
                        "timestamp": "11:35",
                        "title": "Motion Sickness",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Stranger in the Alps",
                        "albumId": "0AkFsgr2q1t75h8aV6uLpC",
                        "swatchColor": "#282A32",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:49"
                  },
                  {
                        "id": "49UDv3b5B1bQx4K43Q486h",
                        "timestamp": "11:30",
                        "title": "Kyoto",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 1,
                  "totalTracks": 4,
                  "topSong": {
                        "title": "Dreams",
                        "count": 1,
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "artist": "Fleetwood Mac"
                  },
                  "topAlbum": {
                        "title": "Punisher",
                        "count": 2,
                        "id": "2xGQEAlDAw7whm4vvt3WvX",
                        "artist": "Phoebe Bridgers"
                  },
                  "topArtist": {
                        "name": "Phoebe Bridgers",
                        "count": 3,
                        "id": "1r1uxoy19fzMxunt3ONAkG"
                  }
            }
      },
      {
            "id": "s12",
            "dateStr": "03 SEP",
            "runtimeMinutes": 58,
            "runtimeStr": "58m",
            "trackCount": 13,
            "uniqueArtistsCount": 9,
            "startTime": "20:45",
            "tagTime": "6D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "5ghIWrUSR7jAjEY0rRI7np",
                        "timestamp": "21:39",
                        "title": "Smells Like Teen Spirit",
                        "artist": "Nirvana",
                        "artistId": "6olE6TJLqED3rqDCT0FyPh",
                        "album": "Nevermind",
                        "albumId": "2guIrUQVRq0VmsvBpJR297",
                        "swatchColor": "#1A3548",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:01"
                  },
                  {
                        "id": "6K4t31amVTZDgR3sKmwUJJ",
                        "timestamp": "21:34",
                        "title": "The Less I Know The Better",
                        "artist": "Tame Impala",
                        "artistId": "5INjqkS1o8h1imAzPqGZBb",
                        "album": "Currents",
                        "albumId": "79dL7FLiJFOO0EoehTaA1m",
                        "swatchColor": "#3F2B48",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:36"
                  },
                  {
                        "id": "7H0ya83CMmgFcOhw0UB6ow",
                        "timestamp": "21:30",
                        "title": "Space Song",
                        "artist": "Beach House",
                        "artistId": "56ZTgzPBDge0OvCGgMO3OY",
                        "album": "Depression Cherry",
                        "albumId": "7vK5a287L67hEw6pWbQvL8",
                        "swatchColor": "#4A1525",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:20"
                  },
                  {
                        "id": "5FVbvFqU2sU5r0fI2b8Q7B",
                        "timestamp": "21:25",
                        "title": "Do I Wanna Know?",
                        "artist": "Arctic Monkeys",
                        "artistId": "7Ln80lUS6He07XvHI8qqHH",
                        "album": "AM",
                        "albumId": "78bpIziExqiI91ztvVJ5nR",
                        "swatchColor": "#1A1A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:32"
                  },
                  {
                        "id": "2Fxmhks0bxGSBdJ92v442m",
                        "timestamp": "21:21",
                        "title": "bad guy",
                        "artist": "Billie Eilish",
                        "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
                        "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
                        "albumId": "0S0KGZnfBGSI3F0irHgAC0",
                        "swatchColor": "#303028",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:14"
                  },
                  {
                        "id": "4pvb0WLRcMtbPGm22F8N0P",
                        "timestamp": "21:16",
                        "title": "exile (feat. Bon Iver)",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:45"
                  },
                  {
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "timestamp": "21:12",
                        "title": "cardigan",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:59"
                  },
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "21:07",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:05"
                  },
                  {
                        "id": "2EqlS6tkEnglzr77vAhx2b",
                        "timestamp": "21:03",
                        "title": "Come Together",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:19"
                  },
                  {
                        "id": "2cGxRwrMygjFu8KiMF1PFR",
                        "timestamp": "20:58",
                        "title": "Instant Crush",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:37"
                  },
                  {
                        "id": "2Foc5Q5nqNiosCNqttzHof",
                        "timestamp": "20:54",
                        "title": "Get Lucky",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "6:09"
                  },
                  {
                        "id": "0vFOzaXqCYFJvnudGii36Q",
                        "timestamp": "20:49",
                        "title": "Money",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:22"
                  },
                  {
                        "id": "3TO7mKlbtik89FRIYod0Ij",
                        "timestamp": "20:45",
                        "title": "Time",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:53"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 3,
                  "totalTracks": 13,
                  "topSong": {
                        "title": "Smells Like Teen Spirit",
                        "count": 1,
                        "id": "5ghIWrUSR7jAjEY0rRI7np",
                        "artist": "Nirvana"
                  },
                  "topAlbum": {
                        "title": "folklore",
                        "count": 2,
                        "id": "2fenSS68JI1h4Fo296JfGr",
                        "artist": "Taylor Swift"
                  },
                  "topArtist": {
                        "name": "Taylor Swift",
                        "count": 2,
                        "id": "06HL4z0CvFAxyc27GXpf02"
                  }
            }
      },
      {
            "id": "s13",
            "dateStr": "03 SEP",
            "runtimeMinutes": 25,
            "runtimeStr": "25m",
            "trackCount": 6,
            "uniqueArtistsCount": 5,
            "startTime": "15:10",
            "tagTime": "6D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "7H0ya83CMmgFcOhw0UB6ow",
                        "timestamp": "15:31",
                        "title": "Space Song",
                        "artist": "Beach House",
                        "artistId": "56ZTgzPBDge0OvCGgMO3OY",
                        "album": "Depression Cherry",
                        "albumId": "7vK5a287L67hEw6pWbQvL8",
                        "swatchColor": "#4A1525",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:20"
                  },
                  {
                        "id": "5FVbvFqU2sU5r0fI2b8Q7B",
                        "timestamp": "15:27",
                        "title": "Do I Wanna Know?",
                        "artist": "Arctic Monkeys",
                        "artistId": "7Ln80lUS6He07XvHI8qqHH",
                        "album": "AM",
                        "albumId": "78bpIziExqiI91ztvVJ5nR",
                        "swatchColor": "#1A1A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/69/9c/b5/699cb5d6-115c-ff73-9d26-e57ea4350d72/887828031795.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:32"
                  },
                  {
                        "id": "2Fxmhks0bxGSBdJ92v442m",
                        "timestamp": "15:23",
                        "title": "bad guy",
                        "artist": "Billie Eilish",
                        "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
                        "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
                        "albumId": "0S0KGZnfBGSI3F0irHgAC0",
                        "swatchColor": "#303028",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:14"
                  },
                  {
                        "id": "4pvb0WLRcMtbPGm22F8N0P",
                        "timestamp": "15:18",
                        "title": "exile (feat. Bon Iver)",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:45"
                  },
                  {
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "timestamp": "15:14",
                        "title": "cardigan",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:59"
                  },
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "15:10",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:05"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 2,
                  "totalTracks": 6,
                  "topSong": {
                        "title": "Space Song",
                        "count": 1,
                        "id": "7H0ya83CMmgFcOhw0UB6ow",
                        "artist": "Beach House"
                  },
                  "topAlbum": {
                        "title": "folklore",
                        "count": 2,
                        "id": "2fenSS68JI1h4Fo296JfGr",
                        "artist": "Taylor Swift"
                  },
                  "topArtist": {
                        "name": "Taylor Swift",
                        "count": 2,
                        "id": "06HL4z0CvFAxyc27GXpf02"
                  }
            }
      },
      {
            "id": "s14",
            "dateStr": "02 SEP",
            "runtimeMinutes": 78,
            "runtimeStr": "1h 18m",
            "trackCount": 19,
            "uniqueArtistsCount": 11,
            "startTime": "21:30",
            "tagTime": "7D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "timestamp": "22:44",
                        "title": "Nights",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:07"
                  },
                  {
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "timestamp": "22:40",
                        "title": "Ivy",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:09"
                  },
                  {
                        "id": "19YKaevk2bce41UVk7RAum",
                        "timestamp": "22:36",
                        "title": "Nikes",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:14"
                  },
                  {
                        "id": "3xKsf9qdS1CyvXS5sb08b8",
                        "timestamp": "22:32",
                        "title": "Pink + White",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "63OQupATfueENZJaC0gNm1",
                        "timestamp": "22:27",
                        "title": "Karma Police",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:21"
                  },
                  {
                        "id": "6LgJvl0Xdtc73RJ1mmpotq",
                        "timestamp": "22:23",
                        "title": "Paranoid Android",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "OK Computer",
                        "albumId": "6dVIqQ8qmQ5GBnJ9shOYGE",
                        "swatchColor": "#283C4A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/07/60/ba/0760ba0f-148c-b18f-d0ff-169ee96f3af5/634904078164.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:23"
                  },
                  {
                        "id": "3zXh2r4hL4QhZ6qV6s0V8r",
                        "timestamp": "22:19",
                        "title": "Reckoner",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:50"
                  },
                  {
                        "id": "35YyxFtlUBloXIwtav7Ch5",
                        "timestamp": "22:15",
                        "title": "Nude",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:15"
                  },
                  {
                        "id": "4I2JA4Z53b01a14oH4pD2t",
                        "timestamp": "22:11",
                        "title": "15 Step",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:57"
                  },
                  {
                        "id": "4clD00s1c0rVqP9Ld0vV48",
                        "timestamp": "22:07",
                        "title": "Weird Fishes / Arpeggi",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:18"
                  },
                  {
                        "id": "5CQ30WqJwcep0pYcV4AMNc",
                        "timestamp": "22:03",
                        "title": "Stairway to Heaven",
                        "artist": "Led Zeppelin",
                        "artistId": "36QJfgBno56YwhRGFKX9Cr",
                        "album": "Led Zeppelin IV",
                        "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
                        "swatchColor": "#3D3528",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "8:02"
                  },
                  {
                        "id": "0z9jsZt7g2t7m4FqF32r8j",
                        "timestamp": "21:59",
                        "title": "God Only Knows",
                        "artist": "The Beach Boys",
                        "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
                        "album": "Pet Sounds",
                        "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
                        "swatchColor": "#2C3A24",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "2:53"
                  },
                  {
                        "id": "0TEekvbt0ZYRucMEC0roYI",
                        "timestamp": "21:55",
                        "title": "Ribs",
                        "artist": "Lorde",
                        "artistId": "163tK9Wjr9P9DmM0AVK7lm",
                        "album": "Pure Heroine",
                        "albumId": "0rmhj0uqT3lP906w3C0123",
                        "swatchColor": "#181818",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:18"
                  },
                  {
                        "id": "4u7EnebtmKWzUH433cf5Qv",
                        "timestamp": "21:51",
                        "title": "Bohemian Rhapsody",
                        "artist": "Queen",
                        "artistId": "1dfeR4HaWDbWqFssioeoL2",
                        "album": "A Night at the Opera",
                        "albumId": "1GbtB4zTqAsyfZEsm1RZSZ",
                        "swatchColor": "#282828",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:54"
                  },
                  {
                        "id": "5UbUbS5bU6xM5yYVqN6sZl",
                        "timestamp": "21:46",
                        "title": "Billie Jean",
                        "artist": "Michael Jackson",
                        "artistId": "3fMbdgg4jU18AjLCKBvRSm",
                        "album": "Thriller",
                        "albumId": "2noRn2Aes5aoQ6vUvt4mhu",
                        "swatchColor": "#352E2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/32/4f/fd/324ffda2-9e51-8f6a-0c2d-c6fd2b41ac55/074643811224.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:54"
                  },
                  {
                        "id": "72Z17vmmeQKAg8bptWvpVG",
                        "timestamp": "21:42",
                        "title": "\"Heroes\"",
                        "artist": "David Bowie",
                        "artistId": "0oSGxfWSnnOXhD2fKuz2Gy",
                        "album": "\"Heroes\"",
                        "albumId": "4I5zzKY1sp4neTeiU0W2Vw",
                        "swatchColor": "#2C2C2C",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e2/65/b2/e265b2ae-48d5-9dd8-0251-6cd6c6c4eb53/190295842826.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:11"
                  },
                  {
                        "id": "5ghIWrUSR7jAjEY0rRI7np",
                        "timestamp": "21:38",
                        "title": "Smells Like Teen Spirit",
                        "artist": "Nirvana",
                        "artistId": "6olE6TJLqED3rqDCT0FyPh",
                        "album": "Nevermind",
                        "albumId": "2guIrUQVRq0VmsvBpJR297",
                        "swatchColor": "#1A3548",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/19/7a/58/197a5870-618b-446f-a193-ca4a84502adc/190295781163.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:01"
                  },
                  {
                        "id": "6K4t31amVTZDgR3sKmwUJJ",
                        "timestamp": "21:34",
                        "title": "The Less I Know The Better",
                        "artist": "Tame Impala",
                        "artistId": "5INjqkS1o8h1imAzPqGZBb",
                        "album": "Currents",
                        "albumId": "79dL7FLiJFOO0EoehTaA1m",
                        "swatchColor": "#3F2B48",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/64/48/5c/64485cc9-968c-68cc-764e-9a7c71733def/00602567155454.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:36"
                  },
                  {
                        "id": "7H0ya83CMmgFcOhw0UB6ow",
                        "timestamp": "21:30",
                        "title": "Space Song",
                        "artist": "Beach House",
                        "artistId": "56ZTgzPBDge0OvCGgMO3OY",
                        "album": "Depression Cherry",
                        "albumId": "7vK5a287L67hEw6pWbQvL8",
                        "swatchColor": "#4A1525",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/09/e0/d5/09e0d559-0682-f0f0-5e0c-3cd11e3114fd/beachhouse_depressioncherry_2400_300.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:20"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 5,
                  "totalTracks": 19,
                  "topSong": {
                        "title": "Nights",
                        "count": 1,
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "artist": "Frank Ocean"
                  },
                  "topAlbum": {
                        "title": "Blonde",
                        "count": 4,
                        "id": "3mH6qwIy9crq0I9YQbOuDf",
                        "artist": "Frank Ocean"
                  },
                  "topArtist": {
                        "name": "Radiohead",
                        "count": 6,
                        "id": "4Z8W4fKeB5YxbusRsdQVPb"
                  }
            }
      },
      {
            "id": "s15",
            "dateStr": "01 SEP",
            "runtimeMinutes": 35,
            "runtimeStr": "35m",
            "trackCount": 8,
            "uniqueArtistsCount": 5,
            "startTime": "18:20",
            "tagTime": "8D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "3zXh2r4hL4QhZ6qV6s0V8r",
                        "timestamp": "18:51",
                        "title": "Reckoner",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "4:50"
                  },
                  {
                        "id": "35YyxFtlUBloXIwtav7Ch5",
                        "timestamp": "18:46",
                        "title": "Nude",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:15"
                  },
                  {
                        "id": "4I2JA4Z53b01a14oH4pD2t",
                        "timestamp": "18:42",
                        "title": "15 Step",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:57"
                  },
                  {
                        "id": "4clD00s1c0rVqP9Ld0vV48",
                        "timestamp": "18:38",
                        "title": "Weird Fishes / Arpeggi",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:18"
                  },
                  {
                        "id": "5CQ30WqJwcep0pYcV4AMNc",
                        "timestamp": "18:33",
                        "title": "Stairway to Heaven",
                        "artist": "Led Zeppelin",
                        "artistId": "36QJfgBno56YwhRGFKX9Cr",
                        "album": "Led Zeppelin IV",
                        "albumId": "5EyIDBAqhnAH9Kc4qvPpeq",
                        "swatchColor": "#3D3528",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/5c/15/9b/5c159b27-95ca-b9a7-84e3-28e795fffd39/dj.kvkrpptq.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "8:02"
                  },
                  {
                        "id": "0z9jsZt7g2t7m4FqF32r8j",
                        "timestamp": "18:29",
                        "title": "God Only Knows",
                        "artist": "The Beach Boys",
                        "artistId": "3pkZyq0Zl0aUe8vFhA0w2v",
                        "album": "Pet Sounds",
                        "albumId": "6DuBaIuxuE2Mv39R4B9jYn",
                        "swatchColor": "#2C3A24",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music116/v4/35/bb/c4/35bbc4eb-9387-97b0-b138-64b7a949ea43/13UABIM03512.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "2:53"
                  },
                  {
                        "id": "0TEekvbt0ZYRucMEC0roYI",
                        "timestamp": "18:24",
                        "title": "Ribs",
                        "artist": "Lorde",
                        "artistId": "163tK9Wjr9P9DmM0AVK7lm",
                        "album": "Pure Heroine",
                        "albumId": "0rmhj0uqT3lP906w3C0123",
                        "swatchColor": "#181818",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/5a/b3/dd5ab3da-e351-ec32-6c01-f008af3c61e1/artwork.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:18"
                  },
                  {
                        "id": "4u7EnebtmKWzUH433cf5Qv",
                        "timestamp": "18:20",
                        "title": "Bohemian Rhapsody",
                        "artist": "Queen",
                        "artistId": "1dfeR4HaWDbWqFssioeoL2",
                        "album": "A Night at the Opera",
                        "albumId": "1GbtB4zTqAsyfZEsm1RZSZ",
                        "swatchColor": "#282828",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/b1/a9/84/b1a984dc-8dce-e8cb-1a0e-20293f7c500a/14DMGIM05548.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:54"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 2,
                  "totalTracks": 8,
                  "topSong": {
                        "title": "Reckoner",
                        "count": 1,
                        "id": "3zXh2r4hL4QhZ6qV6s0V8r",
                        "artist": "Radiohead"
                  },
                  "topAlbum": {
                        "title": "In Rainbows",
                        "count": 4,
                        "id": "7vd91cWv27mKrnG67vR4iR",
                        "artist": "Radiohead"
                  },
                  "topArtist": {
                        "name": "Radiohead",
                        "count": 4,
                        "id": "4Z8W4fKeB5YxbusRsdQVPb"
                  }
            }
      },
      {
            "id": "s16",
            "dateStr": "01 SEP",
            "runtimeMinutes": 12,
            "runtimeStr": "12m",
            "trackCount": 2,
            "uniqueArtistsCount": 1,
            "startTime": "12:05",
            "tagTime": "8D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "35YyxFtlUBloXIwtav7Ch5",
                        "timestamp": "12:11",
                        "title": "Nude",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:15"
                  },
                  {
                        "id": "4I2JA4Z53b01a14oH4pD2t",
                        "timestamp": "12:05",
                        "title": "15 Step",
                        "artist": "Radiohead",
                        "artistId": "4Z8W4fKeB5YxbusRsdQVPb",
                        "album": "In Rainbows",
                        "albumId": "7vd91cWv27mKrnG67vR4iR",
                        "swatchColor": "#3A2A1A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/dd/50/c7/dd50c790-99ac-d3d0-5ab8-e3891fb8fd52/634904032463.png/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:57"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 0,
                  "totalTracks": 2,
                  "topSong": {
                        "title": "Nude",
                        "count": 1,
                        "id": "35YyxFtlUBloXIwtav7Ch5",
                        "artist": "Radiohead"
                  },
                  "topAlbum": {
                        "title": "In Rainbows",
                        "count": 2,
                        "id": "7vd91cWv27mKrnG67vR4iR",
                        "artist": "Radiohead"
                  },
                  "topArtist": {
                        "name": "Radiohead",
                        "count": 2,
                        "id": "4Z8W4fKeB5YxbusRsdQVPb"
                  }
            }
      },
      {
            "id": "s17",
            "dateStr": "31 AUG",
            "runtimeMinutes": 48,
            "runtimeStr": "48m",
            "trackCount": 11,
            "uniqueArtistsCount": 4,
            "startTime": "20:10",
            "tagTime": "9D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "20:54",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:17"
                  },
                  {
                        "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
                        "timestamp": "20:49",
                        "title": "I Know The End",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:44"
                  },
                  {
                        "id": "5xo8RrjJ9CVNrtRg2S3tyW",
                        "timestamp": "20:45",
                        "title": "Motion Sickness",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Stranger in the Alps",
                        "albumId": "0AkFsgr2q1t75h8aV6uLpC",
                        "swatchColor": "#282A32",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:49"
                  },
                  {
                        "id": "49UDv3b5B1bQx4K43Q486h",
                        "timestamp": "20:41",
                        "title": "Kyoto",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "74tLlkN3pmQwBvaMRA4oxE",
                        "timestamp": "20:36",
                        "title": "Money Trees",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "good kid, m.A.A.d city",
                        "albumId": "748dEZwhgnyspuaWIvlyx9",
                        "swatchColor": "#3D352E",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:26"
                  },
                  {
                        "id": "0N3W5qLeLqETRpyPheLGR5",
                        "timestamp": "20:32",
                        "title": "King Kunta",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:54"
                  },
                  {
                        "id": "3iVcQ50DCVupKAh0DxnZ1z",
                        "timestamp": "20:27",
                        "title": "Alright",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:39"
                  },
                  {
                        "id": "7eqoqGkKwgOaWNNHx90uEZ",
                        "timestamp": "20:23",
                        "title": "Nights",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:07"
                  },
                  {
                        "id": "2ZWlPOoWh0626oTaHRnl2A",
                        "timestamp": "20:19",
                        "title": "Ivy",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:09"
                  },
                  {
                        "id": "19YKaevk2bce41UVk7RAum",
                        "timestamp": "20:14",
                        "title": "Nikes",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:14"
                  },
                  {
                        "id": "3xKsf9qdS1CyvXS5sb08b8",
                        "timestamp": "20:10",
                        "title": "Pink + White",
                        "artist": "Frank Ocean",
                        "artistId": "2h93pZq0e7k5yf4Y40u9UR",
                        "album": "Blonde",
                        "albumId": "3mH6qwIy9crq0I9YQbOuDf",
                        "swatchColor": "#3B4A3A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/42/62/50/426250f9-7e39-f907-687c-442caa436636/dj.nhptxziz.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 3,
                  "totalTracks": 11,
                  "topSong": {
                        "title": "Dreams",
                        "count": 1,
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "artist": "Fleetwood Mac"
                  },
                  "topAlbum": {
                        "title": "Blonde",
                        "count": 4,
                        "id": "3mH6qwIy9crq0I9YQbOuDf",
                        "artist": "Frank Ocean"
                  },
                  "topArtist": {
                        "name": "Frank Ocean",
                        "count": 4,
                        "id": "2h93pZq0e7k5yf4Y40u9UR"
                  }
            }
      },
      {
            "id": "s18",
            "dateStr": "30 AUG",
            "runtimeMinutes": 70,
            "runtimeStr": "1h 10m",
            "trackCount": 16,
            "uniqueArtistsCount": 8,
            "startTime": "22:15",
            "tagTime": "10D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "2Fxmhks0bxGSBdJ92v442m",
                        "timestamp": "23:21",
                        "title": "bad guy",
                        "artist": "Billie Eilish",
                        "artistId": "6qqNVTkY8uBg9cP3Jd7DAH",
                        "album": "WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?",
                        "albumId": "0S0KGZnfBGSI3F0irHgAC0",
                        "swatchColor": "#303028",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/1a/37/d1/1a37d1b1-8508-54f2-f541-bf4e437dda76/19UMGIM05028.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:14"
                  },
                  {
                        "id": "4pvb0WLRcMtbPGm22F8N0P",
                        "timestamp": "23:16",
                        "title": "exile (feat. Bon Iver)",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:45"
                  },
                  {
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "timestamp": "23:12",
                        "title": "cardigan",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:59"
                  },
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "23:08",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:05"
                  },
                  {
                        "id": "2EqlS6tkEnglzr77vAhx2b",
                        "timestamp": "23:03",
                        "title": "Come Together",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:19"
                  },
                  {
                        "id": "2cGxRwrMygjFu8KiMF1PFR",
                        "timestamp": "22:59",
                        "title": "Instant Crush",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:37"
                  },
                  {
                        "id": "2Foc5Q5nqNiosCNqttzHof",
                        "timestamp": "22:54",
                        "title": "Get Lucky",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:09"
                  },
                  {
                        "id": "0vFOzaXqCYFJvnudGii36Q",
                        "timestamp": "22:50",
                        "title": "Money",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "6:22"
                  },
                  {
                        "id": "3TO7mKlbtik89FRIYod0Ij",
                        "timestamp": "22:46",
                        "title": "Time",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:53"
                  },
                  {
                        "id": "5e9TFT0nj3YegNVJE4uus4",
                        "timestamp": "22:41",
                        "title": "The Chain",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:30"
                  },
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "22:37",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:17"
                  },
                  {
                        "id": "3CRDbSIZ4r5MsZ0YwxuEkn",
                        "timestamp": "22:33",
                        "title": "I Know The End",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "5:44"
                  },
                  {
                        "id": "5xo8RrjJ9CVNrtRg2S3tyW",
                        "timestamp": "22:28",
                        "title": "Motion Sickness",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Stranger in the Alps",
                        "albumId": "0AkFsgr2q1t75h8aV6uLpC",
                        "swatchColor": "#282A32",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/20/4c/6e/204c6ef3-8e95-4cee-2256-202ca62aebed/60220.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:49"
                  },
                  {
                        "id": "49UDv3b5B1bQx4K43Q486h",
                        "timestamp": "22:24",
                        "title": "Kyoto",
                        "artist": "Phoebe Bridgers",
                        "artistId": "1r1uxoy19fzMxunt3ONAkG",
                        "album": "Punisher",
                        "albumId": "2xGQEAlDAw7whm4vvt3WvX",
                        "swatchColor": "#3A1E22",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/5a/5d/1f/5a5d1fde-7f6f-9997-3bca-d75f1e799464/656605154565.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:04"
                  },
                  {
                        "id": "74tLlkN3pmQwBvaMRA4oxE",
                        "timestamp": "22:19",
                        "title": "Money Trees",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "good kid, m.A.A.d city",
                        "albumId": "748dEZwhgnyspuaWIvlyx9",
                        "swatchColor": "#3D352E",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music122/v4/36/86/ec/3686ec99-dec4-0a01-8b74-2d8a9a0263a7/12UMGIM52988.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:26"
                  },
                  {
                        "id": "0N3W5qLeLqETRpyPheLGR5",
                        "timestamp": "22:15",
                        "title": "King Kunta",
                        "artist": "Kendrick Lamar",
                        "artistId": "2YZyLoL8N0Wb9xBt1NhZWg",
                        "album": "To Pimp a Butterfly",
                        "albumId": "7ycBtnsMtyVbbw3fMwR2nM",
                        "swatchColor": "#222222",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music112/v4/b5/a6/91/b5a69171-5232-3d5b-9c15-8963802f83dd/15UMGIM15814.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:54"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 4,
                  "totalTracks": 16,
                  "topSong": {
                        "title": "bad guy",
                        "count": 1,
                        "id": "2Fxmhks0bxGSBdJ92v442m",
                        "artist": "Billie Eilish"
                  },
                  "topAlbum": {
                        "title": "folklore",
                        "count": 2,
                        "id": "2fenSS68JI1h4Fo296JfGr",
                        "artist": "Taylor Swift"
                  },
                  "topArtist": {
                        "name": "Phoebe Bridgers",
                        "count": 3,
                        "id": "1r1uxoy19fzMxunt3ONAkG"
                  }
            }
      },
      {
            "id": "s19",
            "dateStr": "29 AUG",
            "runtimeMinutes": 36,
            "runtimeStr": "36m",
            "trackCount": 8,
            "uniqueArtistsCount": 4,
            "startTime": "19:40",
            "tagTime": "11D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "20:12",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:05"
                  },
                  {
                        "id": "2EqlS6tkEnglzr77vAhx2b",
                        "timestamp": "20:07",
                        "title": "Come Together",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:19"
                  },
                  {
                        "id": "2cGxRwrMygjFu8KiMF1PFR",
                        "timestamp": "20:03",
                        "title": "Instant Crush",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:37"
                  },
                  {
                        "id": "2Foc5Q5nqNiosCNqttzHof",
                        "timestamp": "19:58",
                        "title": "Get Lucky",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:09"
                  },
                  {
                        "id": "0vFOzaXqCYFJvnudGii36Q",
                        "timestamp": "19:54",
                        "title": "Money",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "6:22"
                  },
                  {
                        "id": "3TO7mKlbtik89FRIYod0Ij",
                        "timestamp": "19:49",
                        "title": "Time",
                        "artist": "Pink Floyd",
                        "artistId": "0k17h0D3J5VfsdmQ1iZtE9",
                        "album": "The Dark Side of the Moon",
                        "albumId": "4LH4d3cOWNNXdsqFd42wzg",
                        "swatchColor": "#141414",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/3e/17/ec/3e17ec6d-f980-c64f-19e0-a6fd8bbf0c10/886445635850.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "6:53"
                  },
                  {
                        "id": "5e9TFT0nj3YegNVJE4uus4",
                        "timestamp": "19:45",
                        "title": "The Chain",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:30"
                  },
                  {
                        "id": "0ofHAoxe9vBkTCp2UQIavz",
                        "timestamp": "19:40",
                        "title": "Dreams",
                        "artist": "Fleetwood Mac",
                        "artistId": "08GQAI4e5rBaRujQwE7AVn",
                        "album": "Rumours",
                        "albumId": "1BZhsjlBYzDbKyJdYBMxev",
                        "swatchColor": "#3A3428",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:17"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 2,
                  "totalTracks": 8,
                  "topSong": {
                        "title": "Here Comes The Sun",
                        "count": 1,
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "artist": "The Beatles"
                  },
                  "topAlbum": {
                        "title": "Abbey Road",
                        "count": 2,
                        "id": "0ETFjACtuP2ADo6LFhL6HN",
                        "artist": "The Beatles"
                  },
                  "topArtist": {
                        "name": "The Beatles",
                        "count": 2,
                        "id": "3WrFJ7ztbogyGnTHbHJFl2"
                  }
            }
      },
      {
            "id": "s20",
            "dateStr": "28 AUG",
            "runtimeMinutes": 24,
            "runtimeStr": "24m",
            "trackCount": 5,
            "uniqueArtistsCount": 3,
            "startTime": "21:10",
            "tagTime": "12D",
            "isOpen": false,
            "tracks": [
                  {
                        "id": "4pvb0WLRcMtbPGm22F8N0P",
                        "timestamp": "21:29",
                        "title": "exile (feat. Bon Iver)",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:45"
                  },
                  {
                        "id": "4R2kfaDFslZEMLoQUTosRH",
                        "timestamp": "21:24",
                        "title": "cardigan",
                        "artist": "Taylor Swift",
                        "artistId": "06HL4z0CvFAxyc27GXpf02",
                        "album": "folklore",
                        "albumId": "2fenSS68JI1h4Fo296JfGr",
                        "swatchColor": "#303030",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/8c/ef/c2/8cefc23a-61b7-05ff-b52a-bb1e4922087c/20UMGIM64216.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "3:59"
                  },
                  {
                        "id": "6dGnYIeXmYdcikdzNNDMm2",
                        "timestamp": "21:20",
                        "title": "Here Comes The Sun",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": true,
                        "duration": "3:05"
                  },
                  {
                        "id": "2EqlS6tkEnglzr77vAhx2b",
                        "timestamp": "21:15",
                        "title": "Come Together",
                        "artist": "The Beatles",
                        "artistId": "3WrFJ7ztbogyGnTHbHJFl2",
                        "album": "Abbey Road",
                        "albumId": "0ETFjACtuP2ADo6LFhL6HN",
                        "swatchColor": "#2D3E35",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "4:19"
                  },
                  {
                        "id": "2cGxRwrMygjFu8KiMF1PFR",
                        "timestamp": "21:10",
                        "title": "Instant Crush",
                        "artist": "Daft Punk",
                        "artistId": "4tZwfgrHOc3mvqYxwDoOD1",
                        "album": "Random Access Memories",
                        "albumId": "4m2880jivSbbyEGAKfITCa",
                        "swatchColor": "#2A2A2A",
                        "albumImageUrl": "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg",
                        "isFirstPlay": false,
                        "duration": "5:37"
                  }
            ],
            "analysis": {
                  "firstPlaysCount": 1,
                  "totalTracks": 5,
                  "topSong": {
                        "title": "exile (feat. Bon Iver)",
                        "count": 1,
                        "id": "4pvb0WLRcMtbPGm22F8N0P",
                        "artist": "Taylor Swift"
                  },
                  "topAlbum": {
                        "title": "folklore",
                        "count": 2,
                        "id": "2fenSS68JI1h4Fo296JfGr",
                        "artist": "Taylor Swift"
                  },
                  "topArtist": {
                        "name": "Taylor Swift",
                        "count": 2,
                        "id": "06HL4z0CvFAxyc27GXpf02"
                  }
            }
      }
]
  }
};

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
    metrics: ["150", "9h 45m", "34", "14 DAYS"],
    entries,
    hasMore,
    nextCursor: lastEntry?.playedAt ?? null,
    nextCursorId: lastEntry?.id ?? null,
    lastSyncedAt: new Date().toISOString(),
  };
}
