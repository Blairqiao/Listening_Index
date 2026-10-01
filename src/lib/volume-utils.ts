const VOLUME_STORAGE_KEY = "listening_index_player_volume";
const TAPER_EXPONENT = 2.5;

export function sliderToVolume(slider: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(slider) ? slider : 0));
  return Math.pow(clamped, TAPER_EXPONENT);
}

export function volumeToSlider(gain: number): number {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(gain) ? gain : 0));
  return Math.pow(clamped, 1 / TAPER_EXPONENT);
}

export function getStoredVolume(defaultVolume = 0.35): number {
  if (typeof window === "undefined") return defaultVolume;
  try {
    const raw = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (raw === null) return defaultVolume;
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : defaultVolume;
  } catch {
    return defaultVolume;
  }
}

export function setStoredVolume(slider: number): void {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.max(0, Math.min(1, slider));
    localStorage.setItem(VOLUME_STORAGE_KEY, clamped.toString());
  } catch {}
}
