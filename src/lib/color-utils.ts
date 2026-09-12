/**
 * Color math and conversion utilities for HSV, RGB, and HEX color spaces.
 */

export interface HSV {
  h: number; // 0 - 360
  s: number; // 0 - 100
  v: number; // 0 - 100
}

export interface RGB {
  r: number; // 0 - 255
  g: number; // 0 - 255
  b: number; // 0 - 255
}

export interface ColorPreset {
  name: string;
  hex: string;
}

export const PRESET_COLORS: ColorPreset[] = [
  { name: "Crimson Red", hex: "#FF2A55" },
  { name: "Safety Orange", hex: "#FF6B00" },
  { name: "Neon Amber", hex: "#FFAE00" },
  { name: "Acid Yellow", hex: "#FFE600" },
  { name: "Terminal Lime", hex: "#76FF49" },
  { name: "Neon Cyan", hex: "#00F5D4" },
  { name: "Electric Blue", hex: "#00A8FF" },
  { name: "Cyber Purple", hex: "#9D4EDD" },
  { name: "Hot Magenta", hex: "#FF007F" },
  { name: "Industrial Mono", hex: "#EDEDE8" },
];

/**
 * Validates a hex color string (#RGB, #RRGGBB, or #RRGGBBAA).
 */
export function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex.trim());
}

/**
 * Normalizes any valid hex string into standard 6-character '#RRGGBB' uppercase.
 */
export function normalizeHex(hex: string, fallback = "#76FF49"): string {
  const clean = hex.trim().replace(/^#/, "");
  if (clean.length === 3) {
    const r = clean[0] + clean[0];
    const g = clean[1] + clean[1];
    const b = clean[2] + clean[2];
    return `#${r}${g}${b}`.toUpperCase();
  }
  if (clean.length === 6) {
    return `#${clean}`.toUpperCase();
  }
  if (clean.length === 8) {
    // Drop alpha channel for standard CSS color representation
    return `#${clean.slice(0, 6)}`.toUpperCase();
  }
  return fallback.toUpperCase();
}

/**
 * Applies an accent color directly to all CSS variables and active style tags in the DOM.
 * Guarantees immediate repaint for Tailwind v4 utilities (--color-music-accent, text-music-accent, etc.)
 */
export function applyAccentColorToDom(color: string): void {
  if (typeof document === "undefined") return;
  const hex = normalizeHex(color);

  // 1. Set on documentElement inline style with 'important' priority
  // Inline styles with 'important' have the highest possible cascade priority in CSS.
  document.documentElement.style.setProperty("--music-accent", hex, "important");
  document.documentElement.style.setProperty("--color-music-accent", hex, "important");

  // 2. Set on body inline style with 'important' priority
  if (document.body) {
    document.body.style.setProperty("--music-accent", hex, "important");
    document.body.style.setProperty("--color-music-accent", hex, "important");
  }

  // 3. Update or create the dynamic style tag with highest specificity
  let styleTag = document.getElementById("active-theme-accent") as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = "active-theme-accent";
    document.head.appendChild(styleTag);
  }
  styleTag.textContent = `:root, html, body { --music-accent: ${hex} !important; --color-music-accent: ${hex} !important; }`;
}

/**
 * Converts HSV (0-360, 0-100, 0-100) to RGB (0-255).
 */
export function hsvToRgb(h: number, s: number, v: number): RGB {
  const normH = ((h % 360) + 360) % 360;
  const normS = Math.max(0, Math.min(100, s)) / 100;
  const normV = Math.max(0, Math.min(100, v)) / 100;

  const c = normV * normS;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = normV - c;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (normH >= 0 && normH < 60) {
    rPrime = c;
    gPrime = x;
    bPrime = 0;
  } else if (normH >= 60 && normH < 120) {
    rPrime = x;
    gPrime = c;
    bPrime = 0;
  } else if (normH >= 120 && normH < 180) {
    rPrime = 0;
    gPrime = c;
    bPrime = x;
  } else if (normH >= 180 && normH < 240) {
    rPrime = 0;
    gPrime = x;
    bPrime = c;
  } else if (normH >= 240 && normH < 300) {
    rPrime = x;
    gPrime = 0;
    bPrime = c;
  } else {
    rPrime = c;
    gPrime = 0;
    bPrime = x;
  }

  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  };
}

/**
 * Converts RGB (0-255) to 6-digit uppercase Hex '#RRGGBB'.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clampR = Math.max(0, Math.min(255, Math.round(r)));
  const clampG = Math.max(0, Math.min(255, Math.round(g)));
  const clampB = Math.max(0, Math.min(255, Math.round(b)));

  const hexR = clampR.toString(16).padStart(2, "0");
  const hexG = clampG.toString(16).padStart(2, "0");
  const hexB = clampB.toString(16).padStart(2, "0");

  return `#${hexR}${hexG}${hexB}`.toUpperCase();
}

/**
 * Converts HSV directly to uppercase Hex '#RRGGBB'.
 */
export function hsvToHex(h: number, s: number, v: number): string {
  const rgb = hsvToRgb(h, s, v);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/**
 * Converts Hex string to RGB (0-255).
 */
export function hexToRgb(hex: string): RGB | null {
  if (!isValidHex(hex)) return null;
  const clean = hex.trim().replace(/^#/, "");
  let r = 0;
  let g = 0;
  let b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }

  return { r, g, b };
}

/**
 * Converts RGB (0-255) to HSV (0-360, 0-100, 0-100).
 */
export function rgbToHsv(r: number, g: number, b: number): HSV {
  const normR = Math.max(0, Math.min(255, r)) / 255;
  const normG = Math.max(0, Math.min(255, g)) / 255;
  const normB = Math.max(0, Math.min(255, b)) / 255;

  const max = Math.max(normR, normG, normB);
  const min = Math.min(normR, normG, normB);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === normR) {
      h = 60 * (((normG - normB) / delta) % 6);
    } else if (max === normG) {
      h = 60 * ((normB - normR) / delta + 2);
    } else {
      h = 60 * ((normR - normG) / delta + 4);
    }
  }

  if (h < 0) {
    h += 360;
  }

  const s = max === 0 ? 0 : (delta / max) * 100;
  const v = max * 100;

  return {
    h: Math.round(h),
    s: Math.round(s),
    v: Math.round(v),
  };
}

/**
 * Converts Hex string to HSV.
 */
export function hexToHsv(hex: string, fallback: HSV = { h: 105, s: 71, v: 100 }): HSV {
  const rgb = hexToRgb(hex);
  if (!rgb) return fallback;
  return rgbToHsv(rgb.r, rgb.g, rgb.b);
}
