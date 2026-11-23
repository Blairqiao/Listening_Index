import { test } from "node:test";
import assert from "node:assert/strict";
import * as spectrum from "../src/lib/spectrum-source";

const { BAND_COUNT } = spectrum;
const BIN_COUNT = 1024;
const SAMPLE_RATE = 48000;

type Calculate = (
  fft: Float32Array,
  edges: Int32Array,
  smoothed: Float32Array,
  out: Float32Array,
  dt?: number
) => void;

function calculate(...args: Parameters<Calculate>) {
  (spectrum as unknown as { calculateSpectrumBands: Calculate }).calculateSpectrumBands(...args);
}

function edges(): Int32Array {
  return (spectrum as unknown as { bandEdges: (bins: number, rate: number) => Int32Array }).bandEdges(
    BIN_COUNT,
    SAMPLE_RATE
  );
}

function flatSpectrum(db: number): Float32Array {
  return new Float32Array(BIN_COUNT).fill(db);
}

/** About -28 dB in the bass, falling 3 dB per octave to about -55 dB at 16 kHz. */
function musicSpectrum(): Float32Array {
  const fft = new Float32Array(BIN_COUNT);
  for (let b = 0; b < BIN_COUNT; b++) {
    const hz = Math.max(30, (b / BIN_COUNT) * (SAMPLE_RATE / 2));
    fft[b] = -28 - 3 * Math.log2(hz / 30);
  }
  return fft;
}

function settle(fft: Float32Array, start = 0, frames = 600, dt = 1 / 60): Float32Array {
  const smoothed = new Float32Array(BAND_COUNT).fill(start);
  const out = new Float32Array(BAND_COUNT);
  const bandEdges = edges();
  for (let i = 0; i < frames; i++) calculate(fft, bandEdges, smoothed, out, dt);
  return out;
}

test("a music-like spectrum leaves every band below full height with visible movement", () => {
  const out = settle(musicSpectrum());
  for (let i = 0; i < BAND_COUNT; i++) {
    assert.ok(out[i] < 1, `band ${i} is pinned at ${out[i]}`);
  }
  assert.ok(
    Array.from(out).some((v) => v > 0.2),
    "at least some bands should rise above 0.2"
  );
});

test("digital silence converges to all zeros", () => {
  const out = settle(flatSpectrum(-Infinity), 0.8);
  for (let i = 0; i < BAND_COUNT; i++) {
    assert.ok(out[i] < 1e-6, `band ${i} rests at ${out[i]}`);
  }
});

test("a level below the floor converges to all zeros", () => {
  const out = settle(flatSpectrum(-120), 0.8);
  for (let i = 0; i < BAND_COUNT; i++) {
    assert.ok(out[i] < 1e-6, `band ${i} rests at ${out[i]}`);
  }
});

test("band values never go negative with a negative dt", () => {
  const bandEdges = edges();
  const out = new Float32Array(BAND_COUNT);
  for (const start of [0, 0.9]) {
    for (const fft of [musicSpectrum(), flatSpectrum(-Infinity)]) {
      const smoothed = new Float32Array(BAND_COUNT).fill(start);
      calculate(fft, bandEdges, smoothed, out, -0.05);
      for (let i = 0; i < BAND_COUNT; i++) {
        assert.ok(Number.isFinite(out[i]) && out[i] >= 0 && out[i] <= 1, `band ${i} is ${out[i]}`);
      }
    }
  }
});

test("the same elapsed time gives about the same result at 60 and 120 frames per second", () => {
  const rise60 = settle(musicSpectrum(), 0, 6, 1 / 60);
  const rise120 = settle(musicSpectrum(), 0, 12, 1 / 120);
  const fall60 = settle(flatSpectrum(-Infinity), 0.9, 6, 1 / 60);
  const fall120 = settle(flatSpectrum(-Infinity), 0.9, 12, 1 / 120);
  for (let i = 0; i < BAND_COUNT; i++) {
    assert.ok(Math.abs(rise60[i] - rise120[i]) < 1e-3, `rising band ${i}: ${rise60[i]} vs ${rise120[i]}`);
    assert.ok(Math.abs(fall60[i] - fall120[i]) < 1e-3, `falling band ${i}: ${fall60[i]} vs ${fall120[i]}`);
  }
  assert.ok(rise60[0] > 0.1 && fall60[0] > 0.1 && fall60[0] < 0.9, "the window must catch the bands mid-move");
});

test("a level exactly at the floor rests at zero in every band", () => {
  const out = settle(flatSpectrum(-75), 0.8);
  for (let i = 0; i < BAND_COUNT; i++) {
    assert.ok(out[i] < 1e-6, `band ${i} rests at ${out[i]}`);
  }
});

/**
 * Closer to a real mix than `musicSpectrum`: -3 dB per octave up to 1 kHz,
 * then -5 dB per octave, as cymbals and air sit well below the kick and bass.
 */
function realisticSpectrum(offsetDb = 0): Float32Array {
  const fft = new Float32Array(BIN_COUNT);
  for (let b = 0; b < BIN_COUNT; b++) {
    const hz = Math.max(30, (b / BIN_COUNT) * (SAMPLE_RATE / 2));
    const oct = Math.log2(hz / 30);
    const knee = Math.log2(1000 / 30);
    const db = oct <= knee ? -28 - 3 * oct : -28 - 3 * knee - 5 * (oct - knee);
    fft[b] = db + offsetDb;
  }
  return fft;
}

function quarterMeans(out: Float32Array): { bass: number; treble: number } {
  const q = BAND_COUNT / 4;
  let bass = 0;
  let treble = 0;
  for (let i = 0; i < q; i++) {
    bass += out[i];
    treble += out[BAND_COUNT - q + i];
  }
  return { bass: bass / q, treble: treble / q };
}

type Gain = { value: number };
function createGain(): Gain {
  return (spectrum as unknown as { createSpectrumGain: () => Gain }).createSpectrumGain();
}

function settleWithGain(fft: Float32Array, gain: Gain, frames = 600, smoothed?: Float32Array): Float32Array {
  const state = smoothed ?? new Float32Array(BAND_COUNT);
  const out = new Float32Array(BAND_COUNT);
  const bandEdges = edges();
  const calc = (spectrum as unknown as {
    calculateSpectrumBands: (...a: [Float32Array, Int32Array, Float32Array, Float32Array, number, Gain]) => void;
  }).calculateSpectrumBands;
  for (let i = 0; i < frames; i++) calc(fft, bandEdges, state, out, 1 / 60, gain);
  return out;
}

test("a realistic mix lights treble about as much as bass", () => {
  const { bass, treble } = quarterMeans(settle(realisticSpectrum()));
  const ratio = treble / bass;
  assert.ok(ratio > 0.8 && ratio < 1.25, `treble/bass = ${ratio.toFixed(2)} (bass ${bass.toFixed(2)}, treble ${treble.toFixed(2)})`);
});

test("a pink-like spectrum stays balanced too", () => {
  const { bass, treble } = quarterMeans(settle(musicSpectrum()));
  const ratio = treble / bass;
  assert.ok(ratio > 0.8 && ratio < 1.3, `treble/bass = ${ratio.toFixed(2)}`);
});

test("auto gain lifts a quiet track to use most of the height", () => {
  const out = settleWithGain(realisticSpectrum(-25), createGain());
  const max = Math.max(...out);
  assert.ok(max > 0.75, `loudest band only reaches ${max.toFixed(2)}`);
});

test("auto gain keeps a hot master from pinning every band", () => {
  const out = settleWithGain(realisticSpectrum(15), createGain());
  for (let i = 0; i < BAND_COUNT; i++) {
    assert.ok(out[i] < 0.98, `band ${i} is pinned at ${out[i]}`);
  }
});

test("auto gain leaves silence at zero and does not run away while silent", () => {
  const gain = createGain();
  const smoothed = new Float32Array(BAND_COUNT);
  settleWithGain(realisticSpectrum(), gain, 300, smoothed);
  const before = gain.value;
  const out = settleWithGain(flatSpectrum(-Infinity), gain, 600, smoothed);
  for (let i = 0; i < BAND_COUNT; i++) {
    assert.ok(out[i] < 1e-6, `band ${i} rests at ${out[i]}`);
  }
  assert.ok(gain.value <= before + 1e-6, `gain climbed from ${before} to ${gain.value} in silence`);
});
