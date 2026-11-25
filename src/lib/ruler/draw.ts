import {
  boundaryLabel,
  tickRank,
  weekStartLabel,
  type RulerLevel,
  type RulerUnit,
} from "@/lib/ruler/units";

export interface RulerCtx {
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  fillStyle: string;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

export interface RulerPalette {
  accent: string;
  major: string;
  medium?: string;
  minor: string;
  baseline: string;
  label: string;
  font: string;
}

export const MINOR_TICK = 5;
export const MEDIUM_TICK = 7;
export const MAJOR_TICK = 9;
export const PHANTOM_ALPHA = 0.35;
export const LABEL_ROW = 11;

interface LabelCandidate {
  text: string;
  x: number;
  priority: number;
  accent: boolean;
  phantom: boolean;
}

const CULL_MARGIN = 48;
const LABEL_EDGE_PAD = 2;
const LABEL_MIN_GAP = 6;

function findFirstVisibleIndex(centers: number[], minTapeX: number): number {
  let low = 0;
  let high = centers.length - 1;
  let ans = centers.length;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (centers[mid] >= minTapeX) {
      ans = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return ans;
}

/**
 * Draws the zoom ruler tape, ticks, boundary labels, and center reticle onto
 * `ctx` using only `RulerCtx` operations and colors from `palette`.
 */
export function drawRuler(
  ctx: RulerCtx,
  p: {
    width: number;
    height: number;
    level: RulerLevel;
    units: RulerUnit[];
    centers: number[];
    offset: number;
    realFirst: number;
    realLast: number;
    selected: number | null;
    allMode: boolean;
    palette: RulerPalette;
  },
): void {
  const { width, height, level, units, centers, offset, selected, allMode, palette } = p;
  if (width <= 0 || height <= 0) return;

  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const baseline = height - 1;
  const tickZoneMax = Math.max(0, baseline - LABEL_ROW);
  const minorHeight = Math.min(MINOR_TICK, tickZoneMax);
  const mediumHeight = Math.min(MEDIUM_TICK, tickZoneMax);
  const majorHeight = Math.min(MAJOR_TICK, tickZoneMax);

  ctx.fillStyle = palette.baseline;
  ctx.fillRect(0, baseline, width, 1);

  const minTapeX = offset - centerX - CULL_MARGIN;
  const maxTapeX = offset + centerX + CULL_MARGIN;
  const startIdx = findFirstVisibleIndex(centers, minTapeX);

  ctx.font = palette.font;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  const candidates: LabelCandidate[] = [];

  for (let i = startIdx; i < units.length; i++) {
    const cx = centers[i];
    if (cx > maxTapeX) break;

    const u = units[i];
    const sx = Math.round(centerX + (cx - offset));
    const isSelected = !allMode && !u.phantom && selected !== null && i === selected;

    const rank = tickRank(level, u);
    const th =
      rank === "major" ? majorHeight : rank === "medium" ? mediumHeight : minorHeight;
    ctx.globalAlpha = u.phantom ? PHANTOM_ALPHA : 1;

    if (!u.phantom && (allMode || isSelected)) {
      ctx.fillStyle = palette.accent;
      ctx.fillRect(sx - 0.5, baseline - th, 1.5, th);
    } else {
      ctx.fillStyle =
        rank === "major"
          ? palette.major
          : rank === "medium"
            ? (palette.medium ?? palette.minor)
            : palette.minor;
      ctx.fillRect(sx, baseline - th, 1, th);
    }

    const bLabel = boundaryLabel(level, u);
    if (isSelected) {
      const text = bLabel ?? (level === "day" ? u.short : null);
      if (text) {
        candidates.push({
          text,
          x: sx,
          priority: 3,
          accent: true,
          phantom: u.phantom,
        });
      }
    } else if (bLabel) {
      candidates.push({
        text: bLabel,
        x: sx,
        priority: 2,
        accent: false,
        phantom: u.phantom,
      });
    } else {
      const wLabel = weekStartLabel(level, u);
      if (wLabel) {
        candidates.push({
          text: wLabel,
          x: sx,
          priority: 1,
          accent: false,
          phantom: u.phantom,
        });
      }
    }

    ctx.globalAlpha = 1;
  }

  candidates.sort((a, b) => b.priority - a.priority || a.x - b.x);
  const placed: Array<[number, number]> = [];
  for (const c of candidates) {
    const w = ctx.measureText(c.text).width;
    const left = c.x - w / 2;
    const right = c.x + w / 2;
    if (left < LABEL_EDGE_PAD || right > width - LABEL_EDGE_PAD) continue;
    if (
      placed.some(([pl, pr]) => left < pr + LABEL_MIN_GAP && right > pl - LABEL_MIN_GAP)
    ) {
      continue;
    }
    placed.push([left, right]);
    ctx.globalAlpha = c.phantom ? PHANTOM_ALPHA : 1;
    ctx.fillStyle = c.accent ? palette.accent : palette.label;
    ctx.fillText(c.text, c.x, 1);
  }
  ctx.globalAlpha = 1;

  const reticleHeight = height - LABEL_ROW;
  if (!allMode && reticleHeight > 0) {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(Math.round(centerX) - 1, LABEL_ROW, 2, reticleHeight);
  }
}
