/**
 * Band sources for the spectrum visualizer.
 *
 * A source produces `BAND_COUNT` normalised levels (0..1) per animation frame,
 * lowest frequency first. Two implementations exist because the dashboard runs
 * on Vercel, where the server has no audio device to listen to:
 *
 *   - `SyntheticSpectrumSource` fakes a plausible spectrum from track metadata.
 *     It is decorative, but it works for every visitor with no permissions.
 *   - `LiveAudioSpectrumSource` runs a real FFT over audio the viewer shares
 *     via getDisplayMedia. It is genuine, but needs a click and a picker.
 *
 * The band layout, dB window and attack/release constants mirror `spectrum.py`
 * in the `sound` project. The treble tilt and auto gain are tuned here.
 */

export const BAND_COUNT = 32;

const LOW_HZ = 30;
const HIGH_HZ = 16000;
// In Web Audio AnalyserNode (N=2048, Blackman window), a 0 dBFS sine wave peaks at
// ~ -13.5 dBFS, and mixed musical peaks reach -6 to -10 dBFS. Setting CEIL_DB to -10
// preserves real audio headroom so medium tracks bounce dynamically instead of pinning.
const FLOOR_DB = -75;
const CEIL_DB = -10;
const ATTACK = 0.55; // how fast a band jumps up (0..1 per frame at 60fps)
const RELEASE = 0.16; // how fast it falls back
// Each band averages per-bin dB, and a log-spaced band holds more bins as it
// climbs. Per-bin energy in a mix falls 3 dB per octave (pink) in the low end
// and about 5 dB per octave above 1 kHz, so the top of the display would sit
// 30+ dB under the bass. 4 dB per octave over the 9 octaves shown evens it out.
const TILT_DB_PER_OCTAVE = 4;
const OCTAVES = Math.log2(HIGH_HZ / LOW_HZ);
// The tilt fades in over this many dB above the floor, so silence rests at zero.
const TILT_FADE_DB = 12;
// Auto gain scales the loudest band toward this height. Mixes differ by 20+ dB
// in loudness, so a fixed dB window leaves quiet tracks short and hot ones pinned.
const GAIN_TARGET_PEAK = 0.9;
const GAIN_MIN = 0.6;
const GAIN_MAX = 3;
// Below this loudest-band level the input counts as silence and the gain holds.
const GAIN_GATE = 0.12;
const GAIN_DOWN_PER_SEC = 4; // fast, so a loud section does not pin for long
const GAIN_UP_PER_SEC = 0.6; // slow, so the display does not pump between beats

export interface SpectrumSource {
  /** Fills `out` with the current band levels. Called once per frame. */
  read(out: Float32Array, dt: number): void;
  /** Releases any hardware or timers. Safe to call more than once. */
  stop(): void;
}

/** Log-spaced band edges, as indices into an FFT of `binCount` bins. */
export function bandEdges(binCount: number, sampleRate: number): Int32Array {
  const edges = new Int32Array(BAND_COUNT + 1);
  const nyquist = sampleRate / 2;
  for (let i = 0; i <= BAND_COUNT; i++) {
    const hz = LOW_HZ * Math.pow(HIGH_HZ / LOW_HZ, i / BAND_COUNT);
    edges[i] = Math.min(binCount - 1, Math.round((hz / nyquist) * binCount));
  }
  // Guarantee every band owns at least one bin, or low bands read as silence.
  for (let i = 1; i <= BAND_COUNT; i++) {
    if (edges[i] <= edges[i - 1]) edges[i] = edges[i - 1] + 1;
  }
  return edges;
}

/** Auto gain state, kept by the caller between frames. */
export interface SpectrumGain {
  value: number;
}

export function createSpectrumGain(): SpectrumGain {
  return { value: 1 };
}

const targets = new Float32Array(BAND_COUNT);

/**
 * Transforms raw FFT frequency data into 32 normalized band levels (0..1).
 * Applies decibel tilt, multi-bin energy aggregation, and frame-rate scaled ballistics.
 * With `gain`, it also scales levels so the loudest band sits near the top.
 */
export function calculateSpectrumBands(
  fft: Float32Array,
  edges: Int32Array,
  smoothed: Float32Array,
  out: Float32Array,
  dt = 1 / 60,
  gain?: SpectrumGain
): void {
  // Frame-rate independent ballistics matching ATTACK=0.55, RELEASE=0.16 at 60fps
  // A negative dt would give a negative rate and push bands below zero.
  const seconds = Math.max(0, dt);
  const frames = seconds * 60;
  const attackRate = 1 - Math.pow(1 - ATTACK, frames);
  const releaseRate = 1 - Math.pow(1 - RELEASE, frames);
  let loudest = 0;

  for (let i = 0; i < BAND_COUNT; i++) {
    let peak = -Infinity;
    let sum = 0;
    const start = edges[i];
    const end = edges[i + 1];
    const count = end - start;

    for (let b = start; b < end; b++) {
      const val = fft[b];
      if (val > peak) peak = val;
      sum += val;
    }

    // Blend average and peak for multi-bin bands to preserve transient punch
    // without letting single-bin noise spikes in wide upper bands saturate the bar.
    const rawDb = count > 1 ? 0.6 * (sum / count) + 0.4 * peak : peak;
    // Treble tilt in the decibel domain. It fades in just above the floor, so
    // silence rests at zero and a band crossing the floor does not jump.
    const aboveFloor = Number.isFinite(rawDb) ? Math.max(0, rawDb - FLOOR_DB) : 0;
    const tiltDb =
      (i / (BAND_COUNT - 1)) * OCTAVES * TILT_DB_PER_OCTAVE * Math.min(1, aboveFloor / TILT_FADE_DB);
    const level = Math.max(0, (aboveFloor + tiltDb) / (CEIL_DB - FLOOR_DB));
    targets[i] = level;
    if (level > loudest) loudest = level;
  }

  if (gain && loudest > GAIN_GATE) {
    const desired = Math.max(GAIN_MIN, Math.min(GAIN_MAX, GAIN_TARGET_PEAK / loudest));
    const perSec = desired < gain.value ? GAIN_DOWN_PER_SEC : GAIN_UP_PER_SEC;
    gain.value += (desired - gain.value) * (1 - Math.exp(-perSec * seconds));
  }
  const g = gain ? gain.value : 1;

  for (let i = 0; i < BAND_COUNT; i++) {
    const target = Math.min(1, targets[i] * g);
    const rate = target > smoothed[i] ? attackRate : releaseRate;
    smoothed[i] += (target - smoothed[i]) * rate;
    out[i] = smoothed[i];
  }
}

/** Deterministic hash so the same track always animates the same way. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * A plausible-looking spectrum built from layered oscillators rather than real
 * audio. Bass bands pulse on a beat, mids drift, treble shimmers. The seed ties
 * the pattern to a track so switching tracks visibly changes the shape.
 */
export class SyntheticSpectrumSource implements SpectrumSource {
  private smoothed = new Float32Array(BAND_COUNT);
  private phase = 0;
  private seed: number;
  private active: boolean;

  constructor(trackKey: string, active = true) {
    this.seed = hashString(trackKey || "idle");
    this.active = active;
  }

  /** Swap the pattern without tearing down the animation loop. */
  setTrack(trackKey: string, active: boolean) {
    this.seed = hashString(trackKey || "idle");
    this.active = active;
  }

  read(out: Float32Array, dt: number) {
    this.phase += dt;
    // 90-140 BPM depending on the track, expressed as beats per second.
    const bps = (90 + this.seed * 50) / 60;
    const beat = Math.pow(Math.max(0, Math.sin(this.phase * Math.PI * bps)), 8);
    // Between sessions the strip stays alive but visibly calmer. Damping much
    // below this reads as a dead flat line, which is how the demo data looks.
    const idle = this.active ? 1 : 0.62;

    for (let i = 0; i < BAND_COUNT; i++) {
      const f = i / (BAND_COUNT - 1);
      const offset = this.seed * 10 + i * 0.7;
      // Bass follows the beat, mids and treble wander on slower sines so the
      // display never settles into an obvious repeating pattern.
      const kick = beat * Math.max(0, 1 - f * 2.2);
      // Raising these to a power makes each layer spend most of its time near
      // zero and spike occasionally, which is what gives the display its
      // contrast. A plain sine sits around its midpoint and reads as a
      // uniform hedge of bars.
      const body =
        0.78 *
        (0.5 + 0.5 * Math.sin(this.phase * (0.7 + f * 1.9) + offset)) ** 3 *
        (1 - f * 0.35);
      const shimmer =
        0.55 *
        (0.5 + 0.5 * Math.sin(this.phase * (3.1 + f * 6.0) + offset * 2)) ** 2 *
        f;
      const target = Math.min(1, (kick * 0.85 + body + shimmer) * idle);

      const rate = target > this.smoothed[i] ? ATTACK : RELEASE;
      this.smoothed[i] += (target - this.smoothed[i]) * rate;
      out[i] = this.smoothed[i];
    }
  }

  stop() {
    /* nothing to release */
  }
}

/**
 * Real FFT over audio the viewer shares. `create` resolves once the share
 * prompt is accepted, and rejects if the viewer cancels or shares video only.
 */
export class LiveAudioSpectrumSource implements SpectrumSource {
  private smoothed = new Float32Array(BAND_COUNT);
  private gain = createSpectrumGain();
  private edges: Int32Array;
  // Explicitly backed by a plain ArrayBuffer: getFloatFrequencyData rejects a
  // SharedArrayBuffer-backed view, which is what a bare Float32Array widens to.
  private fft: Float32Array<ArrayBuffer>;

  private constructor(
    private ctx: AudioContext,
    private analyser: AnalyserNode,
    private stream: MediaStream
  ) {
    this.fft = new Float32Array(new ArrayBuffer(analyser.frequencyBinCount * 4));
    this.edges = bandEdges(analyser.frequencyBinCount, ctx.sampleRate);
  }

  static async create(): Promise<LiveAudioSpectrumSource> {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true,
    });
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("NO_AUDIO_TRACK");
    }
    // The video track is only along for the ride — Chrome will not offer tab
    // audio without it, so take it and immediately stop it.
    stream.getVideoTracks().forEach((t) => t.stop());

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    ctx.createMediaStreamSource(stream).connect(analyser);
    // Deliberately not connected to ctx.destination: routing shared audio back
    // to the speakers would double what the viewer hears.
    return new LiveAudioSpectrumSource(ctx, analyser, stream);
  }

  /** Fires when the viewer clicks the browser's "Stop sharing" bar. */
  onEnded(cb: () => void) {
    this.stream.getAudioTracks().forEach((t) => t.addEventListener("ended", cb));
  }

  read(out: Float32Array, dt = 1 / 60) {
    this.analyser.getFloatFrequencyData(this.fft);
    calculateSpectrumBands(this.fft, this.edges, this.smoothed, out, dt, this.gain);
  }

  stop() {
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close().catch(() => {});
  }
}
