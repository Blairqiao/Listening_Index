export * from "./types";

import { buildMergeTree } from "./merge-tree";
import { segmentAnalyzedWeeks } from "./segment";
import { computeShiftsAndGradualSpans, isPhaseInShift } from "./shifts";
import {
  MIN_PHASE_WEEKS,
  TOP_ARTISTS,
  type TasteArtist,
  type TastePhase,
  type TastePhasesData,
  type WeekArtistRow,
} from "./types";
import {
  buildGramMatrix,
  buildWeekSeries,
  prevDay,
  weekSaturday,
} from "./vectors";

/**
 * Computes nested Taste Phases, Taste Eras, and Taste Shifts from weekly Artist Play counts.
 */
export function computeTastePhases(
  rows: readonly WeekArtistRow[],
  timezone: string
): TastePhasesData {
  const { analyzed, gaps, artistNames } = buildWeekSeries(rows);
  const n = analyzed.length;

  if (n === 0) {
    return {
      timezone,
      analyzedWeeks: 0,
      kFine: 1,
      kEra: 1,
      phases: [],
      shifts: [],
      gaps,
    };
  }

  const G = buildGramMatrix(analyzed.map((w) => w.vector));
  const { kFine, kEra, fineBounds, cost } = segmentAnalyzedWeeks(G);
  const { levels, boundaryMinK, segments } = buildMergeTree(cost, n, fineBounds);
  const { shifts, gradualSpans } = computeShiftsAndGradualSpans(
    analyzed,
    levels,
    boundaryMinK,
    kFine
  );

  const phases: TastePhase[] = segments.map((seg) => {
    const start = analyzed[seg.startIdx].week;
    let end: string;
    if (seg.endIdx === n) {
      end = weekSaturday(analyzed[seg.endIdx - 1].week);
    } else {
      const skippedWeeks =
        analyzed[seg.endIdx].timelineIdx - analyzed[seg.endIdx - 1].timelineIdx - 1;
      end =
        skippedWeeks >= MIN_PHASE_WEEKS
          ? weekSaturday(analyzed[seg.endIdx - 1].week)
          : prevDay(analyzed[seg.endIdx].week);
    }

    let phasePlays = 0;
    const artistCounts = new Map<string, number>();
    for (let i = seg.startIdx; i < seg.endIdx; i++) {
      phasePlays += analyzed[i].plays;
      for (const [artistKey, plays] of analyzed[i].counts) {
        artistCounts.set(artistKey, (artistCounts.get(artistKey) ?? 0) + plays);
      }
    }

    const topArtists: TasteArtist[] = [...artistCounts.entries()]
      .map(([artistKey, plays]) => ({
        name: artistNames.get(artistKey) ?? artistKey,
        plays,
        share: plays / phasePlays,
      }))
      .sort((a, b) =>
        b.plays !== a.plays ? b.plays - a.plays : a.name < b.name ? -1 : a.name > b.name ? 1 : 0
      )
      .slice(0, TOP_ARTISTS);

    return {
      id: `${start}_${end}`,
      start,
      end,
      minK: seg.minK,
      maxK: seg.maxK,
      plays: phasePlays,
      topArtists,
      inShift: isPhaseInShift(seg.startIdx, seg.endIdx, seg.minK, gradualSpans),
    };
  });

  return {
    timezone,
    analyzedWeeks: n,
    kFine,
    kEra,
    phases,
    shifts,
    gaps,
  };
}
