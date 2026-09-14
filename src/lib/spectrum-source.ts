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
 * The band layout, dB window, treble tilt and attack/release constants mirror
 * `spectrum.py` in the `sound` project so both renderers feel the same.
 */

export const BAND_COUNT = 32;

const LOW_HZ = 30;
const HIGH_HZ = 16000;
// A single FFT bin holds a small slice of the total energy, so even a loud mix
// rarely puts one above about -25 dBFS. Mapping against 0 dBFS leaves every bar
// pinned to the floor; this is the range music actually occupies.
const FLOOR_DB = -90;
const CEIL_DB = -25;
const ATTACK = 0.55; // how fast a band jumps up (0..1 per frame)
const RELEASE = 0.16; // how fast it falls back

export interface SpectrumSource {
  /** Fills `out` with the current band levels. Called once per frame. */
  read(out: Float32Array, dt: number): void;
  /** Releases any hardware or timers. Safe to call more than once. */
  stop(): void;
}

/** Treble bins carry far less energy than bass; without a tilt the top half of
 *  the display never moves. */
function trebleTilt(): Float32Array {
  const tilt = new Float32Array(BAND_COUNT);
  for (let i = 0; i < BAND_COUNT; i++) {
    tilt[i] = 1.0 + (2.4 - 1.0) * (i / (BAND_COUNT - 1));
  }
  return tilt;
}

/** Log-spaced band edges, as indices into an FFT of `binCount` bins. */
function bandEdges(binCount: number, sampleRate: number): Int32Array {
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
 * the pattern to a track so switching songs visibly changes the shape.
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
    const idle = this.active ? 1 : 0.55;

    for (let i = 0; i < BAND_COUNT; i++) {
      const f = i / (BAND_COUNT - 1);
      const offset = this.seed * 10 + i * 0.7;
      // Bass follows the beat, mids and treble wander on slower sines so the
      // display never settles into an obvious repeating pattern.
      const kick = beat * Math.max(0, 1 - f * 2.2);
      const body =
        0.5 *
        (0.35 + 0.65 * Math.sin(this.phase * (0.7 + f * 1.9) + offset) ** 2) *
        (1 - f * 0.4);
      const shimmer =
        0.3 * (0.5 + 0.5 * Math.sin(this.phase * (3.1 + f * 6.0) + offset * 2)) * f;
      const target = Math.min(1, (kick * 0.55 + body + shimmer + 0.08) * idle);

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
  private tilt = trebleTilt();
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

  read(out: Float32Array) {
    this.analyser.getFloatFrequencyData(this.fft);
    for (let i = 0; i < BAND_COUNT; i++) {
      let peak = -Infinity;
      for (let b = this.edges[i]; b < this.edges[i + 1]; b++) {
        if (this.fft[b] > peak) peak = this.fft[b];
      }
      const db = Number.isFinite(peak) ? peak : FLOOR_DB;
      const norm = (db - FLOOR_DB) / (CEIL_DB - FLOOR_DB);
      const target = Math.max(0, Math.min(1, norm * this.tilt[i]));

      const rate = target > this.smoothed[i] ? ATTACK : RELEASE;
      this.smoothed[i] += (target - this.smoothed[i]) * rate;
      out[i] = this.smoothed[i];
    }
  }

  stop() {
    this.stream.getTracks().forEach((t) => t.stop());
    void this.ctx.close().catch(() => {});
  }
}
