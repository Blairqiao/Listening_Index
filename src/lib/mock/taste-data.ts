import { computeTastePhases } from "@/lib/taste";
import type { TastePhasesData, WeekArtistRow } from "@/lib/taste/types";
import { CATALOG } from "@/lib/mock/catalog";
import { localDateKey } from "@/lib/range";

const MS_PER_DAY = 86_400_000;
const TOTAL_WEEKS = 160;
const PLAYS_PER_WEEK = 150;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeDistribution(
  artists: readonly string[],
  rand: () => number,
  shared?: ReadonlyMap<string, number>,
  sharedWeight = 0.15
): Map<string, number> {
  const dist = new Map<string, number>();
  let total = 0;
  for (let i = 0; i < artists.length; i++) {
    const w = (1 / Math.pow(i + 1.4, 1.1)) * (0.8 + 0.4 * rand());
    dist.set(artists[i], w);
    total += w;
  }
  for (const [artist, weight] of dist) {
    dist.set(artist, (weight / total) * (shared ? 1 - sharedWeight : 1));
  }
  if (shared) {
    for (const [artist, weight] of shared) {
      dist.set(artist, (dist.get(artist) ?? 0) + weight * sharedWeight);
    }
  }
  return dist;
}

function mixDistributions(
  a: ReadonlyMap<string, number>,
  b: ReadonlyMap<string, number>,
  alpha: number
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [k, v] of a) out.set(k, (out.get(k) ?? 0) + v * (1 - alpha));
  for (const [k, v] of b) out.set(k, (out.get(k) ?? 0) + v * alpha);
  return out;
}

function sampleWeekCounts(
  dist: ReadonlyMap<string, number>,
  nPlays: number,
  rand: () => number
): Map<string, number> {
  const keys = [...dist.keys()];
  const cdf: number[] = [];
  let acc = 0;
  for (const k of keys) {
    acc += dist.get(k)!;
    cdf.push(acc);
  }
  const counts = new Map<string, number>();
  for (let i = 0; i < nPlays; i++) {
    const u = rand() * acc;
    let lo = 0;
    let hi = cdf.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    const artist = keys[lo];
    counts.set(artist, (counts.get(artist) ?? 0) + 1);
  }
  return counts;
}

function sundayOnOrBefore(dateIso: string): number {
  const [y, m, d] = dateIso.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d);
  const dow = new Date(utcMs).getUTCDay();
  return utcMs - dow * MS_PER_DAY;
}

function formatUtcDate(utcMs: number): string {
  const d = new Date(utcMs);
  const y = String(d.getUTCFullYear()).padStart(4, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getMockTaste(tz: string, now = new Date()): TastePhasesData {
  const rand = mulberry32(4242);
  const uniqueArtists = [...new Set(Object.values(CATALOG).map((entry) => entry.artist))];

  // Partition Catalog Artists into 4 Taste Eras plus a small shared core
  const sharedArtists = uniqueArtists.slice(0, 4);
  const eraGroups = [
    uniqueArtists.slice(4, 8),
    uniqueArtists.slice(8, 12),
    uniqueArtists.slice(12, 16),
    uniqueArtists.slice(16, 20),
  ];

  const sharedDist = makeDistribution(sharedArtists, rand);
  const eras = eraGroups.map((group) => makeDistribution(group, rand, sharedDist, 0.15));

  const endSundayMs = sundayOnOrBefore(localDateKey(now, tz));
  const startSundayMs = endSundayMs - (TOTAL_WEEKS - 1) * 7 * MS_PER_DAY;

  const rows: WeekArtistRow[] = [];
  for (let t = 0; t < TOTAL_WEEKS; t++) {
    let dist: Map<string, number>;
    if (t < 40) {
      dist = eras[0];
    } else if (t < 80) {
      dist = eras[1];
    } else if (t < 117) {
      dist = eras[2];
    } else if (t < 123) {
      dist = mixDistributions(eras[2], eras[3], (t - 117) / 6);
    } else {
      dist = eras[3];
    }

    const week = formatUtcDate(startSundayMs + t * 7 * MS_PER_DAY);
    const counts = sampleWeekCounts(dist, PLAYS_PER_WEEK, rand);
    for (const [artistName, plays] of counts) {
      rows.push({
        week,
        artistKey: artistName.toLowerCase(),
        artistName,
        plays,
      });
    }
  }

  return computeTastePhases(rows, tz);
}
