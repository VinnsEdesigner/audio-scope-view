
#![allow(dead_code)]
#![allow(clippy::manual_clamp, clippy::needless_range_loop)]

use num_complex::Complex;
use rustfft::FftPlanner;
use std::f32::consts::PI;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum WindowType {
    Rectangular,
    #[default]
    Hann,
    Hamming,
    Blackman,
}

pub fn apply_window(samples: &[f32], window_type: WindowType) -> Vec<f32> {
    let n = samples.len();
    let mut result = Vec::with_capacity(n);

    for i in 0..n {
        let w = match window_type {
            WindowType::Rectangular => 1.0,
            WindowType::Hann => 0.5 * (1.0 - (2.0 * PI * i as f32 / (n - 1) as f32).cos()),
            WindowType::Hamming => 0.54 - 0.46 * (2.0 * PI * i as f32 / (n - 1) as f32).cos(),
            WindowType::Blackman => {
                0.42 - 0.5 * (2.0 * PI * i as f32 / (n - 1) as f32).cos()
                    + 0.08 * (4.0 * PI * i as f32 / (n - 1) as f32).cos()
            }
        };
        result.push(samples[i] * w);
    }

    result
}

pub struct FftProcessor {
    planner: FftPlanner<f32>,
}

impl FftProcessor {
    pub fn new() -> Self {
        Self {
            planner: FftPlanner::new(),
        }
    }

    pub fn compute_magnitudes(&mut self, samples: &[f32], _sample_rate: f32) -> Vec<f32> {
        let n = samples.len();
        if n == 0 {
            return Vec::new();
        }

        let size = n.next_power_of_two();
        let mut padded = samples.to_vec();
        padded.resize(size, 0.0);

        let windowed = apply_window(&padded, WindowType::Hann);

        let mut input: Vec<Complex<f32>> = windowed.iter().map(|&x| Complex::new(x, 0.0)).collect();

        let fft = self.planner.plan_fft_forward(size);

        fft.process(&mut input);

        let half = size / 2;
        let mut magnitudes = Vec::with_capacity(half);

        for i in 0..half {
            let mag = input[i].norm() / (size as f32).sqrt();
            let db = 20.0 * (mag.max(1e-10_f32)).log10();
            magnitudes.push(db.max(-100.0));
        }

        magnitudes
    }

    #[allow(dead_code)]
    pub fn find_peak_frequency(
        &mut self,
        samples: &[f32],
        sample_rate: f32,
        min_freq: f32,
        max_freq: f32,
    ) -> Option<(f32, f32)> {
        let n = samples.len();
        if n == 0 {
            return None;
        }

        let magnitudes = self.compute_magnitudes(samples, sample_rate);
        let freq_resolution = sample_rate / n as f32;

        let min_bin = (min_freq / freq_resolution) as usize;
        let max_bin = (max_freq / freq_resolution) as usize;

        let mut max_mag = f32::NEG_INFINITY;
        let mut peak_bin = 0;

        for i in min_bin..max_bin.min(magnitudes.len()) {
            if magnitudes[i] > max_mag {
                max_mag = magnitudes[i];
                peak_bin = i;
            }
        }

        let peak_freq = peak_bin as f32 * freq_resolution;
        Some((peak_freq, max_mag))
    }

    pub fn compute_spectrum(
        &mut self,
        samples: &[f32],
        sample_rate: f32,
        window: WindowType,
    ) -> Spectrum {
        let n = samples.len();
        if n == 0 {
            return Spectrum::default();
        }

        let size = n.next_power_of_two();
        let freq_resolution = sample_rate / size as f32;

        let windowed = apply_window(samples, window);
        let mut input: Vec<Complex<f32>> = windowed.iter().map(|&x| Complex::new(x, 0.0)).collect();
        input.resize(size, Complex::new(0.0, 0.0));

        let fft = self.planner.plan_fft_forward(size);
        fft.process(&mut input);

        let half = size / 2;
        let mut frequencies = Vec::with_capacity(half);
        let mut magnitudes_db = Vec::with_capacity(half);
        let mut phases = Vec::with_capacity(half);

        let mut max_mag = f32::NEG_INFINITY;
        let mut peak_bin = 0;

        for i in 0..half {
            let freq = i as f32 * freq_resolution;
            let mag = input[i].norm() / (size as f32).sqrt();
            let db = 20.0 * (mag.max(1e-10_f32)).log10();
            let phase = input[i].arg();

            frequencies.push(freq);
            magnitudes_db.push(db.max(-100.0));
            phases.push(phase);

            if db > max_mag {
                max_mag = db;
                peak_bin = i;
            }
        }

        Spectrum {
            frequencies,
            magnitudes_db,
            phases: Some(phases),
            peak_frequency: peak_bin as f32 * freq_resolution,
            peak_magnitude_db: max_mag,
            sample_rate,
            window_size: n,
        }
    }
}

impl Default for FftProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Debug for FftProcessor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("FftProcessor").finish()
    }
}

#[derive(Debug, Clone)]
pub struct Spectrum {
    pub frequencies: Vec<f32>,
    pub magnitudes_db: Vec<f32>,
    pub phases: Option<Vec<f32>>,
    pub peak_frequency: f32,
    pub peak_magnitude_db: f32,
    pub sample_rate: f32,
    pub window_size: usize,
}

impl Default for Spectrum {
    fn default() -> Self {
        Self {
            frequencies: Vec::new(),
            magnitudes_db: Vec::new(),
            phases: None,
            peak_frequency: 0.0,
            peak_magnitude_db: f32::NEG_INFINITY,
            sample_rate: 44100.0,
            window_size: 0,
        }
    }
}

impl Spectrum {
    pub fn linear_magnitudes(&self) -> Vec<f32> {
        self.magnitudes_db
            .iter()
            .map(|&db| 10f32.powf(db / 20.0))
            .collect()
    }

    pub fn normalized_magnitudes(&self) -> Vec<f32> {
        if self.magnitudes_db.is_empty() {
            return Vec::new();
        }

        let max_db = self.peak_magnitude_db;
        let min_db = -100.0;

        self.magnitudes_db
            .iter()
            .map(|&db| ((db - min_db) / (max_db - min_db)).max(0.0).min(1.0))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fft_sine_wave() {
        let sample_rate = 44100.0;
        let frequency = 440.0; // A4 note
        let duration = 0.01; // 10ms
        let n = (sample_rate * duration) as usize;

        let samples: Vec<f32> = (0..n)
            .map(|i| {
                let t = i as f32 / sample_rate;
                (2.0 * PI * frequency * t).sin() * 0.5
            })
            .collect();

        let mut processor = FftProcessor::new();
        let spectrum = processor.compute_spectrum(&samples, sample_rate, WindowType::Hann);

        assert!(
            (spectrum.peak_frequency - frequency).abs() < 50.0,
            "Peak frequency {} should be close to {}",
            spectrum.peak_frequency,
            frequency
        );
    }

    #[test]
    fn test_window_functions() {
        let samples = vec![1.0f32; 1024];

        let rect = apply_window(&samples, WindowType::Rectangular);
        let hann = apply_window(&samples, WindowType::Hann);
        let hamming = apply_window(&samples, WindowType::Hamming);
        let blackman = apply_window(&samples, WindowType::Blackman);

        assert!(rect.iter().all(|&x| (x - 1.0).abs() < 1e-6));

        assert!(hann.iter().any(|&x| x < 1.0));
        assert!(hamming.iter().any(|&x| x < 1.0));
        assert!(blackman.iter().any(|&x| x < 1.0));
    }

    #[test]
    fn test_spectrum_normalized() {
        let samples: Vec<f32> = (0..1024).map(|i| (i as f32 * 0.01).sin()).collect();

        let mut processor = FftProcessor::new();
        let spectrum = processor.compute_spectrum(&samples, 44100.0, WindowType::Hann);

        let normalized = spectrum.normalized_magnitudes();
        assert!(!normalized.is_empty());
        assert!(normalized.iter().all(|&x| x >= 0.0 && x <= 1.0));
    }
}
