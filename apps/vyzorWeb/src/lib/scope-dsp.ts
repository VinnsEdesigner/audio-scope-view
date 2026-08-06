export type TriggerEdge = "rising" | "falling" | "auto";
export type TriggerMode = "auto" | "normal" | "single";

export interface TriggerOptions {
  edge: TriggerEdge;
  level: number;
  hysteresis?: number;
  /** Ignore this many samples at the start (holdoff). */
  holdoff?: number;
}

/**
 * Find the index of the first qualifying trigger crossing.
 * Returns -1 when no crossing is found.
 */
export function findTriggerIndex(data: ArrayLike<number>, options: TriggerOptions): number {
  const { edge, level } = options;
  const hysteresis = options.hysteresis ?? 0.02;
  const start = Math.max(1, options.holdoff ?? 0);

  const risingHit = (previous: number, current: number) =>
    previous < level - hysteresis && current >= level;
  const fallingHit = (previous: number, current: number) =>
    previous > level + hysteresis && current <= level;

  for (let index = start; index < data.length; index++) {
    const previous = data[index - 1];
    const current = data[index];

    if (edge === "rising" && risingHit(previous, current)) return index;
    if (edge === "falling" && fallingHit(previous, current)) return index;
    if (edge === "auto" && (risingHit(previous, current) || fallingHit(previous, current))) {
      return index;
    }
  }

  return -1;
}

/**
 * Align a frame on a trigger point and return a window of `windowSize` samples.
 * Returns undefined when the trigger never fires (caller decides to hold the
 * previous frame in "normal" mode, or free-run in "auto" mode).
 */
export function triggeredWindow(
  data: ArrayLike<number>,
  windowSize: number,
  options: TriggerOptions,
): number[] | undefined {
  if (data.length === 0) return undefined;

  const size = Math.min(windowSize, data.length);
  const searchLimit = Math.max(1, data.length - size);
  const index = findTriggerIndex(data, { ...options, holdoff: options.holdoff ?? 1 });

  if (index === -1) return undefined;

  const start = Math.min(index, searchLimit);
  const out: number[] = Array.from({ length: size });
  for (let offset = 0; offset < size; offset++) out[offset] = data[start + offset] ?? 0;
  return out;
}

export function resampleTo(data: ArrayLike<number>, points: number): number[] {
  if (data.length === 0) return [];
  if (data.length === points) return [...(data as unknown as number[])];

  const out: number[] = Array.from({ length: points });
  const step = data.length / points;
  for (let index = 0; index < points; index++) {
    out[index] = data[Math.min(data.length - 1, Math.floor(index * step))];
  }
  return out;
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

/**
 * In-place iterative radix-2 Cooley-Tukey FFT.
 */
function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;

  for (let index = 1, index_ = 0; index < n; index++) {
    let bit = n >> 1;
    for (; index_ & bit; bit >>= 1) index_ ^= bit;
    index_ ^= bit;
    if (index < index_) {
      [re[index], re[index_]] = [re[index_], re[index]];
      [im[index], im[index_]] = [im[index_], im[index]];
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let start = 0; start < n; start += length) {
      let currentRe = 1;
      let currentIm = 0;

      for (let k = 0; k < length / 2; k++) {
        const aRe = re[start + k];
        const aIm = im[start + k];
        const bRe = re[start + k + length / 2] * currentRe - im[start + k + length / 2] * currentIm;
        const bIm = re[start + k + length / 2] * currentIm + im[start + k + length / 2] * currentRe;

        re[start + k] = aRe + bRe;
        im[start + k] = aIm + bIm;
        re[start + k + length / 2] = aRe - bRe;
        im[start + k + length / 2] = aIm - bIm;

        const nextRe = currentRe * wRe - currentIm * wIm;
        currentIm = currentRe * wIm + currentIm * wRe;
        currentRe = nextRe;
      }
    }
  }
}

export interface Spectrum {
  /** Normalised magnitudes (0..1), index 0 = DC. */
  magnitudes: Float32Array;
  /** Frequency step per bin, in Hz. */
  binHz: number;
  peakFrequency: number;
}

/**
 * Hann-windowed magnitude spectrum of a time-domain frame.
 */
export function computeSpectrum(data: ArrayLike<number>, sampleRate: number): Spectrum {
  const empty = { magnitudes: new Float32Array(), binHz: 0, peakFrequency: 0 };
  if (!data || data.length < 8 || sampleRate <= 0) return empty;

  const size = nextPowerOfTwo(Math.min(data.length, 4096));
  const re = new Float32Array(size);
  const im = new Float32Array(size);

  for (let index = 0; index < size; index++) {
    const sample = index < data.length ? data[index] : 0;
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)));
    re[index] = sample * window;
  }

  fft(re, im);

  const bins = size / 2;
  const magnitudes = new Float32Array(bins);
  let max = 1e-9;
  let peakBin = 0;

  for (let index = 0; index < bins; index++) {
    const magnitude = Math.hypot(re[index], im[index]) / bins;
    magnitudes[index] = magnitude;
    if (index > 0 && magnitude > max) {
      max = magnitude;
      peakBin = index;
    }
  }

  for (let index = 0; index < bins; index++) magnitudes[index] /= max;

  const binHz = sampleRate / size;
  return { magnitudes, binHz, peakFrequency: peakBin * binHz };
}

/** Magnitude (0..1) to dBFS, floored at `floor`. */
export function toDecibels(magnitude: number, floor = -90): number {
  if (magnitude <= 0) return floor;
  return Math.max(floor, 20 * Math.log10(magnitude));
}
