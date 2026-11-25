export const MIN_WEEK_PLAYS = 15; // weeks below this are not analyzed
export const MIN_PHASE_WEEKS = 4; // DP minimum segment length; also the gap and gradual cutoffs
export const NOISE_TAIL_MINLEN = 2; // ACH tail pass; 1 over-splits binge listeners
export const NOISE_TAIL: readonly [number, number] = [0.25, 0.45]; // tail K range as a fraction of n / NOISE_TAIL_MINLEN
export const PEN_C2 = 2.5; // pen(K) = logC(n-1, K-1) + PEN_C2 * (K-1)
export const POLISH_RADIUS = 3; // weeks a kFine boundary may move, once
export const RAMP_WINDOW = 12; // weeks either side of a boundary used by the ramp fit
export const RAMP_CENTER_RADIUS = 6; // center search range, in 0.5-week steps
export const RAMP_MAX_WIDTH = 24;
export const TOP_ARTISTS = 5;

export type SparseVector = Map<string, number>;

export interface WeekArtistRow {
  week: string; // local Sunday YYYY-MM-DD
  artistKey: string;
  artistName: string;
  plays: number;
}

export interface TasteArtist {
  name: string;
  plays: number;
  share: number; // share of the Taste Phase's Plays
}

export interface TastePhase {
  id: string; // `${start}_${end}`
  start: string; // Sunday YYYY-MM-DD of the first analyzed week
  end: string; // Saturday YYYY-MM-DD
  minK: number;
  maxK: number; // this Taste Phase exists at every level K in [minK, maxK]
  plays: number;
  topArtists: TasteArtist[];
  inShift: boolean; // lies inside a gradual Taste Shift ramp at some coarser level
}

export interface TasteShiftAtLevel {
  k: number;
  kind: "sharp" | "gradual";
  widthWeeks: number;
  rampStart: string;
  rampEnd: string;
}

export interface TasteShift {
  week: string;
  minK: number;
  levels: TasteShiftAtLevel[]; // one entry per k in [minK, kFine]
}

export interface TasteGap {
  start: string; // Sunday YYYY-MM-DD
  end: string; // Saturday YYYY-MM-DD
}

export interface TastePhasesData {
  timezone: string;
  analyzedWeeks: number;
  kFine: number;
  kEra: number; // kFine <= 1 means there is nothing to show
  phases: TastePhase[];
  shifts: TasteShift[];
  gaps: TasteGap[];
}
