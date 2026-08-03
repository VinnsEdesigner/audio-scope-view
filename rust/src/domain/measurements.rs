//! Audio Measurements - THD, SNR, and other audio metrics

#![allow(dead_code)]
#![allow(clippy::manual_clamp)]

/// Audio waveform analysis results
#[derive(Debug, Clone, Default)]
pub struct WaveformAnalysis {
    /// Peak amplitude (0 to 1)
    pub peak_amplitude: f32,
    /// RMS amplitude (0 to 1)
    pub rms_amplitude: f32,
    /// Dominant/peak frequency in Hz
    pub dominant_frequency: f32,
    /// Total Harmonic Distortion (0 to 1, displayed as %)
    pub thd: f32,
    /// Signal-to-Noise Ratio in dB
    pub snr: f32,
    /// Crest factor (peak/rms ratio)
    pub crest_factor: f32,
    /// DC offset (average)
    pub dc_offset: f32,
}

/// Frequency component in harmonic analysis
#[derive(Debug, Clone)]
pub struct FrequencyComponent {
    /// Frequency in Hz
    pub frequency: f32,
    /// Magnitude/amplitude
    pub magnitude: f32,
    /// Harmonic number (1 = fundamental)
    pub harmonic: u32,
    /// Phase in radians
    pub phase: f32,
}

/// Harmonic analysis result
#[derive(Debug, Clone)]
pub struct HarmonicAnalysis {
    /// Fundamental frequency
    pub fundamental: FrequencyComponent,
    /// Harmonic components
    pub harmonics: Vec<FrequencyComponent>,
    /// THD calculated from harmonics
    pub thd: f32,
    /// THD+N (Total Harmonic Distortion + Noise)
    pub thdn: f32,
    /// Signal energy
    pub signal_energy: f32,
    /// Noise energy
    pub noise_energy: f32,
}

/// Analyze a waveform and compute all measurements
pub fn analyze_waveform(samples: &[f32], sample_rate: f32) -> WaveformAnalysis {
    if samples.is_empty() {
        return WaveformAnalysis::default();
    }

    let peak_amplitude = find_peak_amplitude(samples);
    let rms_amplitude = compute_rms(samples);
    let dc_offset = compute_dc_offset(samples);
    let crest_factor = if rms_amplitude > 0.0 {
        peak_amplitude / rms_amplitude
    } else {
        0.0
    };

    let dominant_frequency = estimate_dominant_frequency(samples, sample_rate);
    let (thd, snr) = estimate_thd_snr(samples, rms_amplitude);

    WaveformAnalysis {
        peak_amplitude,
        rms_amplitude,
        dominant_frequency,
        thd,
        snr,
        crest_factor,
        dc_offset,
    }
}

/// Find peak (maximum absolute) amplitude
pub fn find_peak_amplitude(samples: &[f32]) -> f32 {
    samples
        .iter()
        .map(|&x| x.abs())
        .fold(0.0f32, |max, x| if x > max { x } else { max })
}

/// Find negative peak (minimum/most negative value) amplitude
/// This is the actual negative peak of the waveform, not the absolute value
pub fn find_negative_peak_amplitude(samples: &[f32]) -> f32 {
    samples
        .iter()
        .fold(0.0f32, |min, &x| if x < min { x } else { min })
}

/// Compute RMS (Root Mean Square) amplitude
pub fn compute_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_squares: f32 = samples.iter().map(|&x| x * x).sum();
    let mean_square = sum_squares / samples.len() as f32;
    mean_square.sqrt()
}

/// Compute DC offset (average)
pub fn compute_dc_offset(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }
    samples.iter().sum::<f32>() / samples.len() as f32
}

/// Zero crossing rate (useful for frequency estimation)
pub fn zero_crossing_rate(samples: &[f32]) -> f32 {
    if samples.len() < 2 {
        return 0.0;
    }

    let mut crossings = 0u32;
    for i in 1..samples.len() {
        if (samples[i - 1] >= 0.0) != (samples[i] >= 0.0) {
            crossings += 1;
        }
    }

    crossings as f32 / (samples.len() - 1) as f32
}

/// Estimate dominant frequency using zero-crossing method
pub fn estimate_dominant_frequency(samples: &[f32], sample_rate: f32) -> f32 {
    let zcr = zero_crossing_rate(samples);
    let freq = zcr * sample_rate / 2.0;
    freq.max(20.0).min(sample_rate / 2.0)
}

/// Estimate THD and SNR from waveform
pub fn estimate_thd_snr(samples: &[f32], _rms: f32) -> (f32, f32) {
    if samples.is_empty() {
        return (0.0, 100.0);
    }

    let dc_offset = compute_dc_offset(samples);
    let centered_samples: Vec<f32> = samples.iter().map(|&x| x - dc_offset).collect();
    let peak = find_peak_amplitude(&centered_samples);

    if peak < 1e-10 {
        return (0.0, 100.0);
    }

    let harmonic_ratio = compute_harmonic_ratio(&centered_samples);
    let thd = (1.0_f32 - harmonic_ratio).max(0.0_f32).min(1.0_f32);

    let snr = if harmonic_ratio > 0.0 {
        20.0 * (harmonic_ratio / (1.0 - harmonic_ratio + 1e-10_f32)).log10()
    } else {
        0.0
    };

    let snr = snr.max(0.0).min(120.0);
    (thd * 100.0, snr)
}

fn compute_harmonic_ratio(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let mean = compute_dc_offset(samples);
    let variance: f32 = samples
        .iter()
        .map(|&x| (x - mean) * (x - mean))
        .sum::<f32>()
        / samples.len() as f32;

    if variance < 1e-10 {
        return 1.0;
    }

    let zcr = zero_crossing_rate(samples);
    let flatness = (zcr * 10.0).min(1.0);
    (1.0_f32 - flatness).max(0.0_f32).min(1.0_f32)
}

/// Perform detailed harmonic analysis using FFT
#[allow(dead_code)]
pub fn analyze_harmonics(samples: &[f32], sample_rate: f32) -> HarmonicAnalysis {
    use super::fft_processor::{FftProcessor, WindowType};

    if samples.is_empty() {
        return HarmonicAnalysis {
            fundamental: FrequencyComponent {
                frequency: 0.0,
                magnitude: 0.0,
                harmonic: 1,
                phase: 0.0,
            },
            harmonics: Vec::new(),
            thd: 0.0,
            thdn: 0.0,
            signal_energy: 0.0,
            noise_energy: 0.0,
        };
    }

    let mut processor = FftProcessor::new();
    let spectrum = processor.compute_spectrum(samples, sample_rate, WindowType::Hann);

    let mut max_mag = f32::NEG_INFINITY;
    let mut peak_idx = 0usize;

    for (i, &mag) in spectrum.magnitudes_db.iter().enumerate() {
        if mag > max_mag && spectrum.frequencies[i] > 20.0 {
            max_mag = mag;
            peak_idx = i;
        }
    }

    let fundamental_freq = spectrum.frequencies.get(peak_idx).copied().unwrap_or(0.0);
    let fundamental_mag = max_mag;

    let fundamental = FrequencyComponent {
        frequency: fundamental_freq,
        magnitude: fundamental_mag,
        harmonic: 1,
        phase: 0.0,
    };

    let mut harmonics = Vec::new();
    let mut harmonic_energies = 0.0_f32;
    let total_energy: f32 = spectrum
        .magnitudes_db
        .iter()
        .map(|&db| {
            let lin = 10.0_f32.powf(db / 10.0);
            lin * lin
        })
        .sum();

    if spectrum.frequencies.len() > 1 {
        let freq_res = spectrum.frequencies[1];

        for h in 2..=10 {
            let harmonic_freq = fundamental_freq * h as f32;
            let bin_idx = (harmonic_freq / freq_res) as usize;

            if bin_idx < spectrum.magnitudes_db.len() {
                let mag = spectrum.magnitudes_db[bin_idx];
                harmonic_energies += 10.0_f32.powf(mag / 10.0);

                harmonics.push(FrequencyComponent {
                    frequency: harmonic_freq,
                    magnitude: mag,
                    harmonic: h,
                    phase: 0.0,
                });
            }
        }
    }

    let signal_energy = 10.0_f32.powf(fundamental_mag / 10.0);
    let noise_energy = (total_energy - signal_energy - harmonic_energies).max(0.0_f32);

    let thd = if signal_energy + harmonic_energies > 0.0 {
        harmonic_energies / (signal_energy + harmonic_energies)
    } else {
        0.0
    };

    let thdn = if signal_energy > 0.0 {
        (harmonic_energies + noise_energy) / signal_energy
    } else {
        0.0
    };

    HarmonicAnalysis {
        fundamental,
        harmonics,
        thd,
        thdn,
        signal_energy,
        noise_energy,
    }
}

/// Format THD as percentage string
pub fn format_thd(thd: f32) -> String {
    format!("{:.2}%", thd)
}

/// Format SNR as dB string
pub fn format_snr(snr: f32) -> String {
    format!("{:.1} dB", snr)
}

// ============================================================================
// Decibel (dB) Conversion Functions
// ============================================================================

/// Reference amplitude for dBFS (full-scale) calculations
const DBFS_REFERENCE: f32 = 1.0;

/// Convert linear amplitude (0 to 1) to decibels (dB)
/// Returns -inf for zero amplitude, clamps to reasonable range
pub fn amplitude_to_db(amplitude: f32) -> f32 {
    if amplitude <= 0.0 {
        f32::NEG_INFINITY
    } else {
        20.0 * amplitude.log10()
    }
}

/// Convert decibels back to linear amplitude
pub fn db_to_amplitude(db: f32) -> f32 {
    if db == f32::NEG_INFINITY {
        0.0
    } else {
        10.0_f32.powf(db / 20.0)
    }
}

/// Convert peak amplitude to dBFS (dB Full Scale)
/// 0 dBFS = maximum representable level (amplitude = 1.0)
/// Negative values indicate headroom below full scale
pub fn peak_to_dbfs(peak_amplitude: f32) -> f32 {
    if peak_amplitude <= 0.0 {
        f32::NEG_INFINITY
    } else {
        20.0 * (peak_amplitude / DBFS_REFERENCE).log10()
    }
}

/// Convert RMS amplitude to dBFS
/// For a pure sine wave, RMS = peak/sqrt(2), so RMS dBFS ≈ peak dBFS - 3dB
pub fn rms_to_dbfs(rms_amplitude: f32) -> f32 {
    if rms_amplitude <= 0.0 {
        f32::NEG_INFINITY
    } else {
        20.0 * (rms_amplitude / DBFS_REFERENCE).log10()
    }
}

/// Convert dBFS to linear amplitude
pub fn dbfs_to_amplitude(dbfs: f32) -> f32 {
    db_to_amplitude(dbfs)
}

/// Format amplitude as dB string
pub fn format_db(value_db: f32) -> String {
    if value_db == f32::NEG_INFINITY {
        "-∞ dB".to_string()
    } else {
        format!("{:.1} dB", value_db)
    }
}

/// Format amplitude as dBFS string (Full Scale)
pub fn format_dbfs(value_dbfs: f32) -> String {
    if value_dbfs == f32::NEG_INFINITY {
        "-∞ dBFS".to_string()
    } else {
        format!("{:.1} dBFS", value_dbfs)
    }
}

pub fn crest_factor_db(crest_factor: f32) -> f32 {
    if crest_factor <= 0.0 {
        f32::NEG_INFINITY
    } else {
        20.0 * crest_factor.log10()
    }
}

/// Compute SNR in dB from signal and noise amplitudes
pub fn snr_to_db(signal_amplitude: f32, noise_amplitude: f32) -> f32 {
    if signal_amplitude <= 0.0 || noise_amplitude <= 0.0 {
        0.0
    } else {
        20.0 * (signal_amplitude / noise_amplitude).log10()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn test_rms_sine_wave() {
        // RMS of a sine wave with peak=1 should be 1/sqrt(2) ≈ 0.707
        // Use a complete number of periods to avoid partial cycles
        let samples: Vec<f32> = (0..10000)
            .map(|i| (i as f32 * 2.0 * std::f32::consts::PI / 100.0).sin())
            .collect();
        let rms = compute_rms(&samples);
        assert!(
            (rms - 0.707).abs() < 0.01,
            "RMS should be ~0.707, got {}",
            rms
        );
    }

    #[test]
    fn test_dc_offset() {
        let samples = vec![1.0f32, 2.0, 3.0, 4.0, 5.0];
        let offset = compute_dc_offset(&samples);
        assert!((offset - 3.0).abs() < 0.001);
    }

    #[test]
    fn test_peak_amplitude() {
        let samples = vec![-0.5f32, 0.3, 0.8, -1.0, 0.2];
        let peak = find_peak_amplitude(&samples);
        assert!((peak - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_analyze_sine_wave() {
        let sample_rate = 44100.0;
        let frequency = 440.0;
        let samples: Vec<f32> = (0..4410)
            .map(|i| {
                let t = i as f32 / sample_rate;
                (2.0 * PI * frequency * t).sin() * 0.8
            })
            .collect();

        let analysis = analyze_waveform(&samples, sample_rate);
        assert!((analysis.peak_amplitude - 0.8).abs() < 0.01);
        assert!((analysis.crest_factor - 1.414).abs() < 0.1);
    }

    // dB conversion tests
    #[test]
    fn test_amplitude_to_db() {
        // amplitude 1.0 = 0 dB
        assert!((amplitude_to_db(1.0) - 0.0).abs() < 0.001);
        // amplitude 0.5 ≈ -6 dB
        assert!((amplitude_to_db(0.5) - (-6.0206)).abs() < 0.01);
        // amplitude 0.0 = -infinity (negative infinity since it's below reference)
        let result = amplitude_to_db(0.0);
        assert!(result.is_infinite() && result.is_sign_negative());
    }

    #[test]
    fn test_db_to_amplitude() {
        // 0 dB = amplitude 1.0
        assert!((db_to_amplitude(0.0) - 1.0).abs() < 0.001);
        // -6 dB ≈ 0.5
        assert!((db_to_amplitude(-6.0206) - 0.5).abs() < 0.01);
        // -infinity = 0
        assert!((db_to_amplitude(f32::NEG_INFINITY) - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_peak_to_dbfs() {
        // peak 1.0 = 0 dBFS
        assert!((peak_to_dbfs(1.0) - 0.0).abs() < 0.001);
        // peak 0.707 ≈ -3 dBFS
        assert!((peak_to_dbfs(0.707).abs() - 3.0).abs() < 0.1);
    }

    #[test]
    fn test_rms_to_dbfs() {
        // For a sine wave, RMS = peak/sqrt(2)
        // If peak = 1.0, RMS ≈ 0.707, which is -3 dBFS
        // But for RMS directly = 1.0, that's 0 dBFS
        assert!((rms_to_dbfs(1.0) - 0.0).abs() < 0.001);
        // RMS 0.5 ≈ -6 dBFS
        assert!((rms_to_dbfs(0.5) - (-6.0206)).abs() < 0.01);
    }

    #[test]
    fn test_db_roundtrip() {
        // Test amplitude -> dB -> amplitude roundtrip
        let original = 0.75;
        let db = amplitude_to_db(original);
        let recovered = db_to_amplitude(db);
        assert!((original - recovered).abs() < 0.0001);

        // Test dBFS -> amplitude -> dBFS roundtrip
        let original_dbfs = -12.0;
        let amp = dbfs_to_amplitude(original_dbfs);
        let recovered_dbfs = rms_to_dbfs(amp);
        assert!((original_dbfs - recovered_dbfs).abs() < 0.001);
    }

    #[test]
    fn test_format_db() {
        assert_eq!(format_db(0.0), "0.0 dB");
        assert_eq!(format_db(-6.0), "-6.0 dB");
        assert_eq!(format_db(f32::NEG_INFINITY), "-∞ dB".to_string());
    }

    #[test]
    fn test_format_dbfs() {
        assert_eq!(format_dbfs(0.0), "0.0 dBFS");
        assert_eq!(format_dbfs(-3.0), "-3.0 dBFS");
        assert_eq!(format_dbfs(f32::NEG_INFINITY), "-∞ dBFS".to_string());
    }
}
