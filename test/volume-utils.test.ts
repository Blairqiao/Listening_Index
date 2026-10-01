import assert from "node:assert";
import test from "node:test";
import { sliderToVolume, volumeToSlider, getStoredVolume, setStoredVolume } from "../src/lib/volume-utils";

test("sliderToVolume applies 2.5 power taper", () => {
  assert.strictEqual(sliderToVolume(0), 0);
  assert.strictEqual(sliderToVolume(1), 1);
  const low = sliderToVolume(0.1);
  // 0.1^2.5 is approx 0.00316 (< 0.005)
  assert.ok(low < 0.005, `Expected low volume < 0.005, got ${low}`);
  const mid = sliderToVolume(0.5);
  // 0.5^2.5 is approx 0.176
  assert.ok(mid > 0.15 && mid < 0.2, `Expected mid volume around 0.176, got ${mid}`);
});

test("volumeToSlider is inverse of sliderToVolume", () => {
  const original = 0.42;
  const gain = sliderToVolume(original);
  const inverted = volumeToSlider(gain);
  assert.ok(Math.abs(original - inverted) < 1e-4);
});

test("volume clamping handles out-of-range inputs", () => {
  assert.strictEqual(sliderToVolume(-0.5), 0);
  assert.strictEqual(sliderToVolume(1.5), 1);
});
