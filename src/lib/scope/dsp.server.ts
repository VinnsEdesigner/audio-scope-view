// Pure-TS port of rust-server/src/dsp.rs. Runs inside TanStack Start
// server routes on Cloudflare Workers — no external server, no WASM.
// Stateless: every request carries the current sample window.

export type Edge = "rising" | "falling" | "auto";

export type Harmonic = { n: number; frequency: number; magnitude: number; db: number };

export type Measurements = {
  rms: number;
  peak_to_peak: number;
  min: number;
  max: number;
  mean: number;
  dc_offset: number;
  crest_factor: number;
  frequency: number;
  frequency_ac: number;
  period_ms: number;
  duty_cycle: number;
  thd: number;
  harmonics: Harmonic[];
  sample_rate: number;
  samples_available: number;
};

export type Frame = { samples: number[]; triggered: boolean; trigger_index: number };

export type Calibration = {
  gain_v_per_unit: number;
  time_factor: number;
  lowpass_hz: number | null;
  smoothing: number;
};

const PI = Math.PI;

function boxcar(data: Float32Array, n: number): Float32Array {
  if (n <= 1 || data.length < n) return data;
  const out = new Float32Array(data.length);
  let acc = 0;
  for (let i = 0; i < data.length; i++) {
    acc += data[i];
    if (i >= n) acc -= data[i - n];
    out[i] = acc / Math.min(i + 1, n);
  }
  return out;
}

function lowpass(data: Float32Array, sr: number, cutoffHz: number): Float32Array {
  const dt = 1 / Math.max(1, sr);
  const rc = 1 / (2 * PI * Math.max(1, cutoffHz));
  const alpha = dt / (rc + dt);
  const out = new Float32Array(data.length);
  let y = 0;
  for (let i = 0; i < data.length; i++) {
    y += alpha * (data[i] - y);
    out[i] = y;
  }
  return out;
}

export function preprocess(raw: Float32Array, cal: Calibration, sr: number): Float32Array {
  let d = raw;
  if (cal.lowpass_hz && cal.lowpass_hz > 0) d = lowpass(d, sr, cal.lowpass_hz);
  if (cal.smoothing > 1) d = boxcar(d, Math.min(64, Math.floor(cal.smoothing)));
  return d;
}

export function frameOf(
  data: Float32Array,
  windowLen: number,
  level: number,
  edge: Edge,
): Frame {
  if (data.length < windowLen) {
    const v = new Array(windowLen).fill(0);
    const n = data.length;
    for (let i = 0; i < n; i++) v[windowLen - n + i] = data[i];
    return { samples: v, triggered: false, trigger_index: 0 };
  }
  const searchEnd = data.length - windowLen;
  let trigger = 0;
  let triggered = false;
  if (edge !== "auto") {
    const pre = Math.floor(windowLen / 8);
    for (let i = 1; i < searchEnd; i++) {
      const a = data[i - 1];
      const b = data[i];
      const crossed =
        edge === "rising" ? a < level && b >= level : a > level && b <= level;
      if (crossed) {
        trigger = Math.max(0, i - pre);
        triggered = true;
        break;
      }
    }
  }
  const out = new Array<number>(windowLen);
  for (let i = 0; i < windowLen; i++) out[i] = data[trigger + i];
  return { samples: out, triggered, trigger_index: trigger };
}

function zeroCrossingFreq(data: Float32Array, mean: number, sr: number): [number, number] {
  const crossings: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1] - mean;
    const b = data[i] - mean;
    if (a < 0 && b >= 0) {
      const frac = Math.abs(b - a) > 1e-9 ? -a / (b - a) : 0;
      crossings.push(i - 1 + frac);
    }
  }
  if (crossings.length < 2) return [0, 0];
  let sum = 0;
  for (let i = 1; i < crossings.length; i++) sum += crossings[i] - crossings[i - 1];
  const avg = sum / (crossings.length - 1);
  return avg <= 0 ? [0, 0] : [sr / avg, avg];
}

function autocorrFreq(data: Float32Array, mean: number, sr: number): number {
  const n = data.length;
  if (n < 128) return 0;
  const minLag = Math.max(1, Math.floor(sr / 4000));
  const maxLag = Math.min(Math.floor(n / 2), Math.floor(sr / 20));
  if (maxLag <= minLag) return 0;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) c[i] = data[i] - mean;
  let bestLag = 0;
  let bestVal = -Infinity;
  for (let lag = minLag; lag < maxLag; lag++) {
    let acc = 0;
    for (let i = 0; i < n - lag; i++) acc += c[i] * c[i + lag];
    if (acc > bestVal) {
      bestVal = acc;
      bestLag = lag;
    }
  }
  return bestLag === 0 ? 0 : sr / bestLag;
}

function dutyCycle(data: Float32Array, mean: number): number {
  if (!data.length) return 0;
  let above = 0;
  for (let i = 0; i < data.length; i++) if (data[i] > mean) above++;
  return above / data.length;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n < 2) return;
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const tr = cr * re[b] - ci * im[b];
        const ti = cr * im[b] + ci * re[b];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

function harmonicsThd(
  data: Float32Array,
  sr: number,
  fundamental: number,
): { harmonics: Harmonic[]; thd: number } {
  if (fundamental <= 0 || sr <= 0 || data.length < 256) return { harmonics: [], thd: 0 };
  let n = Math.min(4096, nextPow2(data.length));
  if (n < 1024) n = 1024;
  const start = Math.max(0, data.length - n);
  const slice = data.subarray(start);
  const m = slice.length;
  let mean = 0;
  for (let i = 0; i < m; i++) mean += slice[i];
  mean /= m;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < m; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * PI * i) / Math.max(1, m - 1));
    re[i] = (slice[i] - mean) * w;
  }
  fft(re, im);
  const half = n >> 1;
  const binHz = sr / n;
  const f0Bin = Math.round(fundamental / binHz);
  if (f0Bin === 0 || f0Bin >= half) return { harmonics: [], thd: 0 };
  const mag = (k: number): number => {
    let best = 0;
    const lo = Math.max(0, k - 2);
    const hi = Math.min(half - 1, k + 2);
    for (let j = lo; j <= hi; j++) {
      const mm = Math.sqrt(re[j] * re[j] + im[j] * im[j]);
      if (mm > best) best = mm;
    }
    return best;
  };
  const fund = Math.max(1e-9, mag(f0Bin));
  const hs: Harmonic[] = [];
  let sq = 0;
  for (let k = 1; k <= 6; k++) {
    const bin = f0Bin * k;
    if (bin >= half) break;
    const mm = mag(bin);
    if (k > 1) sq += mm * mm;
    hs.push({
      n: k,
      frequency: bin * binHz,
      magnitude: mm,
      db: 20 * Math.log10(Math.max(1e-9, mm / fund)),
    });
  }
  return { harmonics: hs, thd: Math.sqrt(sq) / fund };
}

export function measure(data: Float32Array, sr: number): Measurements {
  if (!data.length) {
    return {
      rms: 0, peak_to_peak: 0, min: 0, max: 0, mean: 0, dc_offset: 0,
      crest_factor: 0, frequency: 0, frequency_ac: 0, period_ms: 0,
      duty_cycle: 0, thd: 0, harmonics: [], sample_rate: sr, samples_available: 0,
    };
  }
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < data.length; i++) {
    const s = data[i];
    if (s < min) min = s;
    if (s > max) max = s;
    sum += s;
    sq += s * s;
  }
  const n = data.length;
  const mean = sum / n;
  const rms = Math.sqrt(sq / n);
  const acRms = Math.sqrt(Math.max(0, sq / n - mean * mean));
  const peak = Math.max(Math.abs(max - mean), Math.abs(min - mean));
  const crest = acRms > 1e-9 ? peak / acRms : 0;
  const [freq, periodSamples] = zeroCrossingFreq(data, mean, sr);
  const freqAc = autocorrFreq(data, mean, sr);
  const duty = dutyCycle(data, mean);
  const { harmonics, thd } = harmonicsThd(data, sr, Math.max(freqAc, freq));
  return {
    rms,
    peak_to_peak: max - min,
    min,
    max,
    mean,
    dc_offset: mean,
    crest_factor: crest,
    frequency: freq,
    frequency_ac: freqAc,
    period_ms: periodSamples > 0 ? (1000 * periodSamples) / sr : 0,
    duty_cycle: duty,
    thd,
    harmonics,
    sample_rate: sr,
    samples_available: n,
  };
}

export function spectrumOf(data: Float32Array, size: number): number[] {
  const n = nextPow2(size);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const avail = Math.min(data.length, n);
  const start = data.length - avail;
  let mean = 0;
  for (let i = 0; i < avail; i++) mean += data[start + i];
  mean = avail > 0 ? mean / avail : 0;
  for (let i = 0; i < avail; i++) {
    const w = 0.5 - 0.5 * Math.cos((2 * PI * i) / Math.max(1, avail - 1));
    re[i] = (data[start + i] - mean) * w;
  }
  fft(re, im);
  const half = n >> 1;
  const out = new Array<number>(half);
  for (let i = 0; i < half; i++) {
    out[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / half;
  }
  return out;
}

export function calibratedReadouts(
  m: Measurements,
  cal: Calibration,
): { vpp_v: number; rms_v: number; dc_v: number; frequency_hz: number } {
  const g = cal.gain_v_per_unit || 1;
  const t = cal.time_factor || 1;
  return {
    vpp_v: m.peak_to_peak * g,
    rms_v: m.rms * g,
    dc_v: m.dc_offset * g,
    frequency_hz: (m.frequency_ac || m.frequency) / t,
  };
}

export function decodeFloat32Body(buf: ArrayBuffer): Float32Array {
  // Copy to guarantee 4-byte alignment regardless of source buffer offset.
  const bytes = new Uint8Array(buf);
  const aligned = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(aligned).set(bytes);
  return new Float32Array(aligned);
}

export const DEFAULT_CAL: Calibration = {
  gain_v_per_unit: 1,
  time_factor: 1,
  lowpass_hz: null,
  smoothing: 0,
};

export function parseCalibrationHeader(h: string | null): Calibration {
  if (!h) return DEFAULT_CAL;
  try {
    const j = JSON.parse(h) as Partial<Calibration>;
    return {
      gain_v_per_unit: Number(j.gain_v_per_unit) || 1,
      time_factor: Number(j.time_factor) || 1,
      lowpass_hz:
        j.lowpass_hz == null || Number.isNaN(Number(j.lowpass_hz)) ? null : Number(j.lowpass_hz),
      smoothing: Math.max(0, Math.floor(Number(j.smoothing) || 0)),
    };
  } catch {
    return DEFAULT_CAL;
  }
}