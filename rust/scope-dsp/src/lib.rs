use wasm_bindgen::prelude::*;

/// Signal-processing engine for the phone-ADC/mic oscilloscope.
///
/// Samples are pushed in from the Web Audio pipeline. The engine keeps a
/// ring buffer, finds a stable trigger point (rising/falling edge across a
/// level), and returns a fixed-length window for the canvas to draw. It also
/// computes standard scope measurements and an FFT magnitude spectrum.
#[wasm_bindgen]
pub struct ScopeEngine {
    buffer: Vec<f32>,
    write: usize,
    filled: usize,
    sample_rate: f32,
}

#[wasm_bindgen]
pub struct Measurements {
    pub rms: f32,
    pub peak_to_peak: f32,
    pub min: f32,
    pub max: f32,
    pub frequency: f32,
    pub dc_offset: f32,
}

#[wasm_bindgen]
impl ScopeEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(capacity: usize, sample_rate: f32) -> ScopeEngine {
        let cap = capacity.max(1024);
        ScopeEngine {
            buffer: vec![0.0; cap],
            write: 0,
            filled: 0,
            sample_rate,
        }
    }

    /// Push a block of samples from the mic/ADC line.
    pub fn push(&mut self, samples: &[f32]) {
        let cap = self.buffer.len();
        for &s in samples {
            self.buffer[self.write] = s;
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
        out
    }

    /// Return a triggered window of `window_len` samples.
    /// `edge`: 1 = rising, -1 = falling, 0 = free run (auto).
    pub fn frame(&self, window_len: usize, level: f32, edge: i32) -> Vec<f32> {
        let data = self.linear();
        if data.len() < window_len {
            let mut v = vec![0.0f32; window_len];
            let n = data.len();
            v[window_len - n..].copy_from_slice(&data);
            return v;
        }

        let search_end = data.len() - window_len;
        let mut trigger = 0usize;
        if edge != 0 {
            // scan from a bit back so the trigger sits ~1/8 into the window
            let pre = window_len / 8;
            for i in 1..search_end {
                let a = data[i - 1];
                let b = data[i];
                let crossed = if edge > 0 {
                    a < level && b >= level
                } else {
                    a > level && b <= level
                };
                if crossed {
                    trigger = i.saturating_sub(pre);
                    break;
                }
            }
        }
        data[trigger..trigger + window_len].to_vec()
    }

    pub fn measure(&self) -> Measurements {
        let data = self.linear();
        if data.is_empty() {
            return Measurements { rms: 0.0, peak_to_peak: 0.0, min: 0.0, max: 0.0, frequency: 0.0, dc_offset: 0.0 };
        }
        let n = data.len() as f32;
        let mean = data.iter().sum::<f32>() / n;
        let mut min = f32::MAX;
        let mut max = f32::MIN;
        let mut sq = 0.0f32;
        for &s in &data {
            if s < min { min = s; }
            if s > max { max = s; }
            sq += s * s;
        }
        let rms = (sq / n).sqrt();
        let frequency = self.estimate_frequency(&data, mean);
        Measurements {
            rms,
            peak_to_peak: max - min,
            min,
            max,
            frequency,
            dc_offset: mean,
        }
    }

    fn estimate_frequency(&self, data: &[f32], mean: f32) -> f32 {
        // Zero-crossing (mean-crossing) frequency estimation.
        let mut crossings: Vec<f32> = Vec::new();
        for i in 1..data.len() {
            let a = data[i - 1] - mean;
            let b = data[i] - mean;
            if a < 0.0 && b >= 0.0 {
                // linear interpolate fractional index
                let frac = if (b - a).abs() > 1e-9 { -a / (b - a) } else { 0.0 };
                crossings.push((i - 1) as f32 + frac);
            }
        }
        if crossings.len() < 2 {
            return 0.0;
        }
        let mut sum = 0.0f32;
        for i in 1..crossings.len() {
            sum += crossings[i] - crossings[i - 1];
        }
        let avg_period = sum / (crossings.len() - 1) as f32;
        if avg_period <= 0.0 {
            0.0
        } else {
            self.sample_rate / avg_period
        }
    }

    /// FFT magnitude spectrum (single-sided). Returns `size/2` bins.
    pub fn spectrum(&self, size: usize) -> Vec<f32> {
        let n = size.next_power_of_two();
        let data = self.linear();
        let mut re = vec![0.0f32; n];
        let mut im = vec![0.0f32; n];
        let avail = data.len().min(n);
        let start = data.len() - avail;
        let mean: f32 = if avail > 0 {
            data[start..].iter().sum::<f32>() / avail as f32
        } else {
            0.0
        };
        for i in 0..avail {
            // Hann window + remove DC
            let w = 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / (avail.max(2) - 1) as f32).cos();
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

/// In-place iterative radix-2 Cooley-Tukey FFT.
fn fft(re: &mut [f32], im: &mut [f32]) {
    let n = re.len();
    if n < 2 {
        return;
    }
    // bit reversal
    let mut j = 0usize;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
    }
    let mut len = 2;
    while len <= n {
        let ang = -2.0 * std::f32::consts::PI / len as f32;
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