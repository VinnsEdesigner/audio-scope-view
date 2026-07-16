//! Signal processing engine (server-side).
//!
//! Owns a ring buffer of live samples pushed from the client's audio
//! pipeline, plus every measurement + spectrum + filter the scope UI
//! renders. All heavy lifting stays here — the client only draws.

use serde::Serialize;
use std::f32::consts::PI;

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Edge {
    Rising,
    Falling,
    Auto,
}

#[derive(Debug, Serialize)]
pub struct Measurements {
    pub rms: f32,
    pub peak_to_peak: f32,
    pub min: f32,
    pub max: f32,
    pub mean: f32,
    pub dc_offset: f32,
    pub crest_factor: f32,
    pub frequency: f32,
    pub frequency_ac: f32,
    pub period_ms: f32,
    pub duty_cycle: f32,
    pub thd: f32,
    pub harmonics: Vec<Harmonic>,
    pub sample_rate: f32,
    pub samples_available: usize,
}

#[derive(Debug, Serialize)]
pub struct Harmonic {
    pub n: u32,
    pub frequency: f32,
    pub magnitude: f32,
    pub db: f32,
}

#[derive(Debug, Serialize)]
pub struct Frame {
    pub samples: Vec<f32>,
    pub triggered: bool,
    pub trigger_index: usize,
}

pub struct Engine {
    buffer: Vec<f32>,
    write: usize,
    filled: usize,
    sample_rate: f32,
    /// One-pole IIR low-pass state.
    lpf_state: f32,
    lpf_alpha: Option<f32>,
    /// Simple boxcar filter length (0 = disabled).
    smooth: usize,
}

impl Engine {
    pub fn new(capacity: usize, sample_rate: f32) -> Self {
        Self {
            buffer: vec![0.0; capacity.max(1024)],
            write: 0,
            filled: 0,
            sample_rate,
            lpf_state: 0.0,
            lpf_alpha: None,
            smooth: 0,
        }
    }

    pub fn set_sample_rate(&mut self, sr: f32) {
        if (sr - self.sample_rate).abs() > 1.0 {
            self.sample_rate = sr;
            self.filled = 0;
            self.write = 0;
            self.lpf_state = 0.0;
        }
    }

    pub fn sample_rate(&self) -> f32 {
        self.sample_rate
    }

    /// Enable / disable a first-order IIR low-pass filter on push.
    pub fn set_lowpass(&mut self, cutoff_hz: Option<f32>) {
        self.lpf_alpha = cutoff_hz.map(|fc| {
            let dt = 1.0 / self.sample_rate.max(1.0);
            let rc = 1.0 / (2.0 * PI * fc.max(1.0));
            dt / (rc + dt)
        });
    }

    pub fn set_smoothing(&mut self, n: usize) {
        self.smooth = n.min(64);
    }

    pub fn push(&mut self, samples: &[f32]) {
        let cap = self.buffer.len();
        for &s in samples {
            let mut v = s;
            if let Some(a) = self.lpf_alpha {
                self.lpf_state += a * (v - self.lpf_state);
                v = self.lpf_state;
            }
            self.buffer[self.write] = v;
            self.write = (self.write + 1) % cap;
            if self.filled < cap {
                self.filled += 1;
            }
        }
    }

    fn linear(&self) -> Vec<f32> {
        let cap = self.buffer.len();
        let mut out = Vec::with_capacity(self.filled);
        let start = if self.filled < cap { 0 } else { self.write };
        for i in 0..self.filled {
            out.push(self.buffer[(start + i) % cap]);
        }
        if self.smooth > 1 {
            boxcar(&out, self.smooth)
        } else {
            out
        }
    }

    pub fn frame(&self, window_len: usize, level: f32, edge: Edge) -> Frame {
        let data = self.linear();
        if data.len() < window_len {
            let mut v = vec![0.0f32; window_len];
            let n = data.len();
            if n > 0 {
                v[window_len - n..].copy_from_slice(&data);
            }
            return Frame { samples: v, triggered: false, trigger_index: 0 };
        }
        let search_end = data.len() - window_len;
        let mut trigger = 0usize;
        let mut triggered = false;
        if !matches!(edge, Edge::Auto) {
            let pre = window_len / 8;
            for i in 1..search_end {
                let a = data[i - 1];
                let b = data[i];
                let crossed = match edge {
                    Edge::Rising => a < level && b >= level,
                    Edge::Falling => a > level && b <= level,
                    Edge::Auto => false,
                };
                if crossed {
                    trigger = i.saturating_sub(pre);
                    triggered = true;
                    break;
                }
            }
        }
        Frame {
            samples: data[trigger..trigger + window_len].to_vec(),
            triggered,
            trigger_index: trigger,
        }
    }

    pub fn measure(&self) -> Measurements {
        let data = self.linear();
        if data.is_empty() {
            return Measurements {
                rms: 0.0, peak_to_peak: 0.0, min: 0.0, max: 0.0, mean: 0.0,
                dc_offset: 0.0, crest_factor: 0.0, frequency: 0.0,
                frequency_ac: 0.0, period_ms: 0.0, duty_cycle: 0.0, thd: 0.0,
                harmonics: vec![], sample_rate: self.sample_rate,
                samples_available: 0,
            };
        }
        let n = data.len() as f32;
        let mut min = f32::MAX;
        let mut max = f32::MIN;
        let mut sum = 0.0f32;
        let mut sq = 0.0f32;
        for &s in &data {
            if s < min { min = s; }
            if s > max { max = s; }
            sum += s;
            sq += s * s;
        }
        let mean = sum / n;
        let rms = (sq / n).sqrt();
        let ac_rms = ((sq / n) - mean * mean).max(0.0).sqrt();
        let peak = (max - mean).abs().max((min - mean).abs());
        let crest = if ac_rms > 1e-9 { peak / ac_rms } else { 0.0 };

        let (frequency, period_samples) = zero_crossing_freq(&data, mean, self.sample_rate);
        let frequency_ac = autocorr_freq(&data, mean, self.sample_rate);
        let duty = duty_cycle(&data, mean);

        // FFT-based harmonics + THD (use up to 4096 samples).
        let (harmonics, thd) = harmonics_thd(&data, self.sample_rate, frequency_ac.max(frequency));

        Measurements {
            rms,
            peak_to_peak: max - min,
            min,
            max,
            mean,
            dc_offset: mean,
            crest_factor: crest,
            frequency,
            frequency_ac,
            period_ms: if period_samples > 0.0 { 1000.0 * period_samples / self.sample_rate } else { 0.0 },
            duty_cycle: duty,
            thd,
            harmonics,
            sample_rate: self.sample_rate,
            samples_available: data.len(),
        }
    }

    pub fn spectrum(&self, size: usize) -> Vec<f32> {
        let n = size.next_power_of_two();
        let data = self.linear();
        let mut re = vec![0.0f32; n];
        let mut im = vec![0.0f32; n];
        let avail = data.len().min(n);
        let start = data.len() - avail;
        let mean: f32 = if avail > 0 { data[start..].iter().sum::<f32>() / avail as f32 } else { 0.0 };
        for i in 0..avail {
            let w = 0.5 - 0.5 * (2.0 * PI * i as f32 / (avail.max(2) - 1) as f32).cos();
            re[i] = (data[start + i] - mean) * w;
        }
        fft(&mut re, &mut im);
        let half = n / 2;
        let mut mag = Vec::with_capacity(half);
        for i in 0..half {
            mag.push((re[i] * re[i] + im[i] * im[i]).sqrt() / half as f32);
        }
        mag
    }
}

fn boxcar(data: &[f32], n: usize) -> Vec<f32> {
    if n <= 1 || data.len() < n {
        return data.to_vec();
    }
    let mut out = Vec::with_capacity(data.len());
    let mut acc = 0.0f32;
    for i in 0..data.len() {
        acc += data[i];
        if i >= n { acc -= data[i - n]; }
        let d = (i + 1).min(n) as f32;
        out.push(acc / d);
    }
    out
}

fn zero_crossing_freq(data: &[f32], mean: f32, sr: f32) -> (f32, f32) {
    let mut crossings: Vec<f32> = Vec::new();
    for i in 1..data.len() {
        let a = data[i - 1] - mean;
        let b = data[i] - mean;
        if a < 0.0 && b >= 0.0 {
            let frac = if (b - a).abs() > 1e-9 { -a / (b - a) } else { 0.0 };
            crossings.push((i - 1) as f32 + frac);
        }
    }
    if crossings.len() < 2 { return (0.0, 0.0); }
    let mut sum = 0.0f32;
    for i in 1..crossings.len() {
        sum += crossings[i] - crossings[i - 1];
    }
    let avg = sum / (crossings.len() - 1) as f32;
    if avg <= 0.0 { (0.0, 0.0) } else { (sr / avg, avg) }
}

fn autocorr_freq(data: &[f32], mean: f32, sr: f32) -> f32 {
    let n = data.len();
    if n < 128 { return 0.0; }
    let min_lag = (sr / 4000.0) as usize;
    let max_lag = (sr / 20.0) as usize;
    let max_lag = max_lag.min(n / 2);
    if max_lag <= min_lag { return 0.0; }
    let centered: Vec<f32> = data.iter().map(|s| s - mean).collect();
    let mut best_lag = 0usize;
    let mut best_val = f32::MIN;
    for lag in min_lag..max_lag {
        let mut acc = 0.0f32;
        for i in 0..(n - lag) { acc += centered[i] * centered[i + lag]; }
        if acc > best_val { best_val = acc; best_lag = lag; }
    }
    if best_lag == 0 { 0.0 } else { sr / best_lag as f32 }
}

fn duty_cycle(data: &[f32], mean: f32) -> f32 {
    if data.is_empty() { return 0.0; }
    let above = data.iter().filter(|&&s| s > mean).count() as f32;
    above / data.len() as f32
}

fn harmonics_thd(data: &[f32], sr: f32, fundamental: f32) -> (Vec<Harmonic>, f32) {
    if fundamental <= 0.0 || sr <= 0.0 { return (vec![], 0.0); }
    let n = 4096usize.min(data.len().next_power_of_two()).max(1024);
    let n = n.next_power_of_two();
    if data.len() < 256 { return (vec![], 0.0); }
    let start = data.len().saturating_sub(n);
    let slice = &data[start..];
    let m = slice.len();
    let mean = slice.iter().sum::<f32>() / m as f32;
    let mut re = vec![0.0f32; n];
    let mut im = vec![0.0f32; n];
    for i in 0..m {
        let w = 0.5 - 0.5 * (2.0 * PI * i as f32 / (m - 1) as f32).cos();
        re[i] = (slice[i] - mean) * w;
    }
    fft(&mut re, &mut im);
    let half = n / 2;
    let bin_hz = sr / n as f32;
    let f0_bin = (fundamental / bin_hz).round() as usize;
    if f0_bin == 0 || f0_bin >= half { return (vec![], 0.0); }
    let mag = |k: usize| -> f32 {
        let mut best = 0.0f32;
        for j in k.saturating_sub(2)..=(k + 2).min(half - 1) {
            let m = (re[j] * re[j] + im[j] * im[j]).sqrt();
            if m > best { best = m; }
        }
        best
    };
    let fund = mag(f0_bin).max(1e-9);
    let mut hs = Vec::new();
    let mut sq_sum = 0.0f32;
    for k in 1..=6 {
        let bin = f0_bin * k;
        if bin >= half { break; }
        let m = mag(bin);
        if k > 1 { sq_sum += m * m; }
        hs.push(Harmonic {
            n: k as u32,
            frequency: bin as f32 * bin_hz,
            magnitude: m,
            db: 20.0 * (m / fund).max(1e-9).log10(),
        });
    }
    (hs, sq_sum.sqrt() / fund)
}

fn fft(re: &mut [f32], im: &mut [f32]) {
    let n = re.len();
    if n < 2 { return; }
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 { j ^= bit; bit >>= 1; }
        j ^= bit;
        if i < j { re.swap(i, j); im.swap(i, j); }
    }
    let mut len = 2;
    while len <= n {
        let ang = -2.0 * PI / len as f32;
        let (wr, wi) = (ang.cos(), ang.sin());
        let mut i = 0;
        while i < n {
            let (mut cr, mut ci) = (1.0f32, 0.0f32);
            for k in 0..len / 2 {
                let a = i + k;
                let b = i + k + len / 2;
                let tr = cr * re[b] - ci * im[b];
                let ti = cr * im[b] + ci * re[b];
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
                let ncr = cr * wr - ci * wi;
                ci = cr * wi + ci * wr;
                cr = ncr;
            }
            i += len;
        }
        len <<= 1;
    }
}