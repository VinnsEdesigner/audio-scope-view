// dsp-wasm.test.ts — parity test: load the WASM module in Node and run the C++
// DSP core against known test vectors.
//
// Per the architecture spec (§4, step 3): CI must load the WASM module in Node
// and run an FFT against a known vector. These tests also cover measurements,
// trigger, generators, and the LZ4 round-trip — mirroring the Rust FFI tests
// in rust/src/infrastructure/dsp_ffi.rs so parity is provable across all three
// bindings (Rust FFI, WASM/JS, native C++).

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AudioScopeDsp } from "../src";

const SR = 44100;
const N = 4096;
const FREQ = 440;

/** Generate a normalized sine wave at FREQ Hz. */
function sineWave(freq: number, n: number, sr: number, amp = 0.5): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / sr) * amp;
  }
  return out;
}

describe("AudioScopeDsp (WASM)", () => {
  const dsp = new AudioScopeDsp();

  beforeAll(async () => {
    await dsp.load();
  });

  afterAll(() => {
    dsp.dispose();
  });

  it("loads the WASM module and reports a version", () => {
    expect(dsp.loaded).toBe(true);
    expect(dsp.version()).toMatch(/audio-scope-view DSP core/);
  });

  it("finds the 440 Hz peak in a sine wave via FFT", () => {
    const samples = sineWave(FREQ, N, SR);
    const peak = dsp.findPeakFrequency(samples, SR, 20, SR / 2);
    expect(peak).not.toBeNull();
    expect(peak!.frequency).toBeCloseTo(FREQ, -1.5); // within ~50 Hz
  });

  it("computes a half-spectrum with non-empty magnitudes", () => {
    const samples = sineWave(FREQ, N, SR);
    const mags = dsp.computeMagnitudes(samples, SR);
    expect(mags.length).toBeGreaterThan(0);
    // The peak bin should have the largest magnitude.
    const peakBin = mags.indexOf(Math.max(...mags));
    const binHz = SR / (1 << Math.ceil(Math.log2(N)));
    const peakFreq = peakBin * binHz;
    expect(peakFreq).toBeCloseTo(FREQ, -1.5);
  });

  it("computes a full spectrum with frequencies + dB + peak", () => {
    const samples = sineWave(FREQ, N, SR);
    const spec = dsp.computeSpectrum(samples, SR, "hann");
    expect(spec.frequencies.length).toBe(spec.magnitudesDb.length);
    expect(spec.peakFrequency).toBeCloseTo(FREQ, -1.5);
    expect(spec.sampleRate).toBe(SR);
    // Phases array, when present, must align with the frequency bins.
    if (spec.hasPhases) {
      expect(spec.phases).not.toBeNull();
      expect(spec.phases!.length).toBe(spec.frequencies.length);
    }
  });

  it("analyzes a sine wave's amplitude + RMS", () => {
    const amp = 0.8;
    const samples = sineWave(FREQ, 4410, SR, amp);
    const a = dsp.analyzeWaveform(samples, SR);
    expect(a.peakAmplitude).toBeCloseTo(amp, 1);
    // RMS of a sine = amp / sqrt(2) ≈ 0.566 for amp=0.8.
    expect(a.rmsAmplitude).toBeCloseTo(amp / Math.SQRT2, 1);
    expect(a.dominantFrequency).toBeCloseTo(FREQ, -1.5);
  });

  it("computes scalar measurements (peak, rms, dc) consistently", () => {
    const samples = sineWave(FREQ, 2048, SR, 0.5);
    expect(dsp.findPeakAmplitude(samples)).toBeCloseTo(0.5, 1);
    expect(dsp.computeRms(samples)).toBeCloseTo(0.5 / Math.SQRT2, 1);
    // A centered sine has ~0 DC offset.
    expect(Math.abs(dsp.computeDcOffset(samples))).toBeLessThan(0.02);
  });

  it("converts between amplitude and dB", () => {
    const db = dsp.amplitudeToDb(1.0);
    expect(db).toBeCloseTo(0, 1);
    expect(dsp.dbToAmplitude(db)).toBeCloseTo(1.0, 2);
  });

  it("round-trips a buffer through LZ4 compress/decompress", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) samples[i] = i * 0.001;
    const cw = dsp.compressWaveform(samples);
    expect(cw.sampleCount).toBe(samples.length);
    expect(cw.data.length).toBeGreaterThan(0);
    const recovered = dsp.decompressWaveform(cw.data, cw.sampleCount);
    expect(recovered).not.toBeNull();
    expect(recovered!.length).toBe(samples.length);
    for (let i = 0; i < samples.length; i++) {
      expect(recovered![i]).toBeCloseTo(samples[i], 5);
    }
  });

  it("finds a rising-edge trigger crossing", () => {
    // A sine that crosses the level upward around the expected phase.
    const samples = sineWave(FREQ, N, SR, 1.0);
    const idx = dsp.findTrigger(samples, { edge: "rising", level: 0.0, hysteresis: 0.02 });
    expect(idx.index).toBeGreaterThanOrEqual(0);
  });

  it("resamples a buffer to a target point count", () => {
    const samples = sineWave(FREQ, N, SR, 1.0);
    const out = dsp.resampleTo(samples, 1024);
    expect(out.length).toBe(1024);
  });

  it("generates a sine wave via the C++ synthesizer", () => {
    const out = dsp.generateWaveform({
      kind: "sine", frequency: FREQ, amplitude: 0.5,
      sampleRate: SR, numSamples: N,
    });
    expect(out.length).toBe(N);
    // Peak should match the requested amplitude.
    expect(Math.max(...out)).toBeCloseTo(0.5, 1);
  });

  it("generates bounded white noise", () => {
    const out = dsp.generateWaveform({
      kind: "noise", amplitude: 1.0, noiseType: "white",
      sampleRate: SR, numSamples: 1024,
    });
    expect(out.length).toBe(1024);
    const peak = Math.max(...out.map(Math.abs));
    expect(peak).toBeLessThanOrEqual(1.0 + 1e-5);
  });
});
