#![allow(dead_code)]

use crate::domain::fft_processor::{FftProcessor, WindowType};
use crate::domain::Waveform;

#[derive(Debug, Clone)]
pub struct SpectrogramConfig {
    pub window_size: usize,
    pub overlap: usize,
    pub min_freq: f32,
    pub max_freq: f32,
}

impl Default for SpectrogramConfig {
    fn default() -> Self {
        Self {
            window_size: 1024,
            overlap: 512,
            min_freq: 0.0,
            max_freq: 22050.0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct SpectrogramData {
    pub frequencies: Vec<f32>,
    pub time_bins: Vec<i64>,
    pub magnitudes: Vec<Vec<f32>>,
    pub sample_rate: u32,
    pub window_size: usize,
    pub overlap: usize,
}

impl SpectrogramData {
    pub fn new(
        frequencies: Vec<f32>,
        time_bins: Vec<i64>,
        magnitudes: Vec<Vec<f32>>,
        sample_rate: u32,
        window_size: usize,
        overlap: usize,
    ) -> Self {
        Self {
            frequencies,
            time_bins,
            magnitudes,
            sample_rate,
            window_size,
            overlap,
        }
    }

    pub fn frequency_bin(&self, freq: f32) -> Option<usize> {
        self.frequencies
            .iter()
            .position(|&f| (f - freq).abs() < 1.0)
    }

    pub fn time_bin(&self, timestamp_ms: i64) -> Option<usize> {
        self.time_bins
            .iter()
            .position(|&t| (t - timestamp_ms).abs() < 1)
    }

    pub fn magnitude_at(&self, freq: f32, timestamp_ms: i64) -> Option<f32> {
        let f_idx = self.frequency_bin(freq)?;
        let t_idx = self.time_bin(timestamp_ms)?;
        Some(self.magnitudes[t_idx][f_idx])
    }

    pub fn max_magnitude(&self) -> f32 {
        self.magnitudes
            .iter()
            .flat_map(|row| row.iter())
            .cloned()
            .fold(f32::NEG_INFINITY, f32::max)
    }

    pub fn min_magnitude(&self) -> f32 {
        self.magnitudes
            .iter()
            .flat_map(|row| row.iter())
            .cloned()
            .fold(f32::INFINITY, f32::min)
    }

    pub fn to_image_data(&self, width: usize, height: usize) -> Vec<u8> {
        if self.magnitudes.is_empty() || self.frequencies.is_empty() {
            return vec![0u8; width * height * 3];
        }

        let max_mag = self.max_magnitude();
        let min_mag = self.min_magnitude();
        let range = (max_mag - min_mag).max(0.001);

        let mut pixels = Vec::with_capacity(width * height * 3);
        let time_bins_count = self.time_bins.len();
        let freq_bins_count = self.frequencies.len();

        for y in 0..height {
            let freq_idx = (y as f32 / height as f32 * freq_bins_count as f32) as usize;
            let freq_idx = freq_idx.min(freq_bins_count - 1);

            for x in 0..width {
                let time_idx = (x as f32 / width as f32 * time_bins_count as f32) as usize;
                let time_idx = time_idx.min(time_bins_count - 1);

                let magnitude = self.magnitudes[time_idx][freq_idx];
                let normalized = ((magnitude - min_mag) / range * 255.0) as u8;
                
                let r = normalized;
                let g = normalized.saturating_sub(50);
                let b = normalized.saturating_sub(100);

                pixels.push(r);
                pixels.push(g);
                pixels.push(b);
            }
        }

        pixels
    }
}

pub struct SpectrogramProcessor {
    fft_processor: FftProcessor,
}

impl SpectrogramProcessor {
    pub fn new() -> Self {
        Self {
            fft_processor: FftProcessor::new(),
        }
    }

    pub fn compute(&mut self, waveform: &Waveform, sample_rate: u32, config: SpectrogramConfig) -> SpectrogramData {
        let samples = &waveform.samples;
        let window_size = config.window_size;
        let overlap = config.overlap;
        let hop_size = window_size.saturating_sub(overlap);

        if samples.len() < window_size {
            return SpectrogramData::new(
                vec![],
                vec![],
                vec![],
                sample_rate,
                window_size,
                overlap,
            );
        }

        let start_time_ns = waveform.timestamp.timestamp_nanos_opt().unwrap_or(0);
        let mut time_bins = Vec::new();
        let mut magnitudes = Vec::new();
        let mut frequencies: Vec<f32> = Vec::new();
        let mut position = 0isize;

        while position + window_size as isize <= samples.len() as isize {
            let start = position as usize;
            let end = start + window_size;
            let window = &samples[start..end];

            let spectrum = self.fft_processor.compute_spectrum(
                window,
                sample_rate as f32,
                WindowType::Hann,
            );

            let freq_range_start = spectrum.frequencies
                .iter()
                .position(|&f| f >= config.min_freq)
                .unwrap_or(0);
            let freq_range_end = spectrum.frequencies
                .iter()
                .rposition(|&f| f <= config.max_freq)
                .map(|p| p + 1)
                .unwrap_or(spectrum.frequencies.len());

            let filtered_magnitudes: Vec<f32> = spectrum.magnitudes_db
                [freq_range_start..freq_range_end]
                .to_vec();

            if frequencies.is_empty() {
                frequencies = spectrum.frequencies
                    [freq_range_start..freq_range_end]
                    .to_vec();
            }

            let timestamp_ms = (start_time_ns / 1_000_000) + (position * 1000 / sample_rate as isize) as i64;
            time_bins.push(timestamp_ms);
            magnitudes.push(filtered_magnitudes);

            position += hop_size as isize;
        }

        SpectrogramData::new(
            frequencies,
            time_bins,
            magnitudes,
            sample_rate,
            window_size,
            overlap,
        )
    }

    pub fn compute_default(&mut self, waveform: &Waveform, sample_rate: u32) -> SpectrogramData {
        self.compute(waveform, sample_rate, SpectrogramConfig::default())
    }
}

impl Default for SpectrogramProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl SpectrogramConfig {
    pub fn with_window_size(mut self, size: usize) -> Self {
        self.window_size = size;
        self
    }

    pub fn with_overlap(mut self, overlap: usize) -> Self {
        self.overlap = overlap;
        self
    }

    pub fn with_frequency_range(mut self, min: f32, max: f32) -> Self {
        self.min_freq = min;
        self.max_freq = max;
        self
    }
}
