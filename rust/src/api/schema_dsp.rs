//! DSP Schema - Signal Processing Operations
//! 
//! Wires up the domain DSP modules to the GraphQL API:
//! - FFT Processor
//! - Measurements (THD, SNR, RMS, Peak, etc.)
//! - Spectrogram
//! - Waveform Analysis

use async_graphql::{Context, Object, InputObject, Enum};
use chrono::Utc;
use tracing::info;

use crate::domain::{
    fft_processor::{FftProcessor, Spectrum, WindowType},
    entity_waveform::Waveform,
    measurements::{
        WaveformAnalysis, analyze_waveform, analyze_harmonics, HarmonicAnalysis,
        FrequencyComponent,
    },
    spectrogram::{SpectrogramData, SpectrogramConfig, SpectrogramProcessor},
};

/// Window type for FFT analysis
#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum FFTWindowType {
    Rectangular,
    Hann,
    Hamming,
    Blackman,
}

impl From<FFTWindowType> for WindowType {
    fn from(w: FFTWindowType) -> Self {
        match w {
            FFTWindowType::Rectangular => WindowType::Rectangular,
            FFTWindowType::Hann => WindowType::Hann,
            FFTWindowType::Hamming => WindowType::Hamming,
            FFTWindowType::Blackman => WindowType::Blackman,
        }
    }
}

impl From<WindowType> for FFTWindowType {
    fn from(w: WindowType) -> Self {
        match w {
            WindowType::Rectangular => FFTWindowType::Rectangular,
            WindowType::Hann => FFTWindowType::Hann,
            WindowType::Hamming => FFTWindowType::Hamming,
            WindowType::Blackman => FFTWindowType::Blackman,
        }
    }
}

/// Input for FFT analysis
#[derive(InputObject)]
pub struct FFTAnalysisInput {
    /// Audio samples (normalized -1.0 to 1.0)
    pub samples: Vec<f32>,
    /// Sample rate in Hz
    pub sample_rate: i32,
    /// FFT size (power of 2, defaults to nearest power of 2 >= samples.len())
    pub fft_size: Option<i32>,
    /// Window type to apply
    pub window: Option<FFTWindowType>,
}

/// Output from FFT analysis
pub struct FFTAnalysisResult {
    pub frequencies: Vec<f32>,
    pub magnitudes_db: Vec<f32>,
    pub peak_frequency: f32,
    pub peak_magnitude_db: f32,
    pub bins: i32,
}

#[Object]
impl FFTAnalysisResult {
    /// Frequency values in Hz
    async fn frequencies(&self) -> Vec<f32> {
        self.frequencies.clone()
    }
    
    /// Magnitude spectrum in dB
    async fn magnitudes_db(&self) -> Vec<f32> {
        self.magnitudes_db.clone()
    }
    
    /// Peak frequency in Hz
    async fn peak_frequency(&self) -> f32 {
        self.peak_frequency
    }
    
    /// Peak magnitude in dB
    async fn peak_magnitude_db(&self) -> f32 {
        self.peak_magnitude_db
    }
    
    /// Number of FFT bins
    async fn bins(&self) -> i32 {
        self.bins
    }
}

/// Input for waveform measurements
#[derive(InputObject)]
pub struct WaveformMeasurementInput {
    /// Audio samples (normalized -1.0 to 1.0)
    pub samples: Vec<f32>,
    /// Sample rate in Hz
    pub sample_rate: i32,
}

/// Waveform measurement results
pub struct WaveformMeasurementResult {
    pub analysis: WaveformAnalysis,
}

#[Object]
impl WaveformMeasurementResult {
    /// Peak amplitude (0.0 to 1.0)
    async fn peak_amplitude(&self) -> f32 {
        self.analysis.peak_amplitude
    }
    
    /// RMS amplitude (0.0 to 1.0)
    async fn rms_amplitude(&self) -> f32 {
        self.analysis.rms_amplitude
    }
    
    /// DC offset (average, typically near 0)
    async fn dc_offset(&self) -> f32 {
        self.analysis.dc_offset
    }
    
    /// Crest factor (peak / rms)
    async fn crest_factor(&self) -> f32 {
        self.analysis.crest_factor
    }
    
    /// Dominant/peak frequency in Hz
    async fn dominant_frequency(&self) -> f32 {
        self.analysis.dominant_frequency
    }
    
    /// Total Harmonic Distortion as percentage (0-100%)
    async fn thd_percent(&self) -> f32 {
        self.analysis.thd
    }
    
    /// Signal-to-Noise Ratio in dB
    async fn snr_db(&self) -> f32 {
        self.analysis.snr
    }
}

/// Input for spectrogram computation
#[derive(InputObject)]
pub struct SpectrogramInput {
    /// Audio samples (normalized -1.0 to 1.0)
    pub samples: Vec<f32>,
    /// Sample rate in Hz
    pub sample_rate: i32,
    /// FFT window size
    pub window_size: Option<i32>,
    /// Overlap between windows
    pub overlap: Option<i32>,
    /// Minimum frequency to display
    pub min_freq: Option<f32>,
    /// Maximum frequency to display
    pub max_freq: Option<f32>,
}

/// Spectrogram result
pub struct SpectrogramResult {
    pub spectrogram: SpectrogramData,
}

#[Object]
impl SpectrogramResult {
    /// Frequency values in Hz (Y-axis)
    async fn frequencies(&self) -> Vec<f32> {
        self.spectrogram.frequencies.clone()
    }
    
    /// Time bin values (X-axis) - typically timestamps or indices
    async fn time_bins(&self) -> Vec<i64> {
        self.spectrogram.time_bins.clone()
    }
    
    /// Magnitude data as 2D array [time][frequency] in dB
    async fn magnitudes_db(&self) -> Vec<Vec<f32>> {
        self.spectrogram.magnitudes.clone()
    }
    
    /// Number of time slices
    async fn time_slices(&self) -> i32 {
        self.spectrogram.magnitudes.len() as i32
    }
    
    /// Number of frequency bins
    async fn frequency_bins(&self) -> i32 {
        self.spectrogram.magnitudes.first().map(|v| v.len() as i32).unwrap_or(0)
    }
    
    /// Sample rate used
    async fn sample_rate(&self) -> i32 {
        self.spectrogram.sample_rate as i32
    }
    
    /// FFT window size
    async fn window_size(&self) -> i32 {
        self.spectrogram.window_size as i32
    }
    
    /// Overlap between windows
    async fn overlap(&self) -> i32 {
        self.spectrogram.overlap as i32
    }
}

/// Input for harmonic analysis
#[derive(InputObject)]
pub struct HarmonicAnalysisInput {
    /// Audio samples (normalized -1.0 to 1.0)
    pub samples: Vec<f32>,
    /// Sample rate in Hz
    pub sample_rate: i32,
    /// Expected fundamental frequency (Hz)
    pub expected_fundamental: Option<f32>,
}

/// Individual frequency component
pub struct FrequencyComponentResult {
    component: FrequencyComponent,
}

#[Object]
impl FrequencyComponentResult {
    async fn frequency(&self) -> f32 {
        self.component.frequency
    }
    
    async fn magnitude(&self) -> f32 {
        self.component.magnitude
    }
    
    async fn harmonic(&self) -> i32 {
        self.component.harmonic as i32
    }
    
    async fn phase_radians(&self) -> f32 {
        self.component.phase
    }
}

/// Harmonic analysis result
pub struct HarmonicAnalysisResult {
    pub analysis: HarmonicAnalysis,
}

#[Object]
impl HarmonicAnalysisResult {
    /// Fundamental frequency component
    async fn fundamental(&self) -> FrequencyComponentResult {
        FrequencyComponentResult { component: self.analysis.fundamental.clone() }
    }
    
    /// Harmonic components
    async fn harmonics(&self) -> Vec<FrequencyComponentResult> {
        self.analysis.harmonics.iter()
            .map(|c| FrequencyComponentResult { component: c.clone() })
            .collect()
    }
    
    /// THD percentage
    async fn thd_percent(&self) -> f32 {
        self.analysis.thd
    }
    
    /// THD+N percentage
    async fn thdn_percent(&self) -> f32 {
        self.analysis.thdn
    }
    
    /// Signal energy
    async fn signal_energy(&self) -> f32 {
        self.analysis.signal_energy
    }
    
    /// Noise energy
    async fn noise_energy(&self) -> f32 {
        self.analysis.noise_energy
    }
}

/// DSP Query Root - Read operations
#[derive(Default)]
pub struct DspQueryRoot;

#[Object]
impl DspQueryRoot {
    /// Get DSP processor capabilities
    async fn dsp_capabilities(&self) -> DspCapabilities {
        DspCapabilities {
            max_fft_size: 16384,
            min_fft_size: 64,
            supported_windows: vec![
                FFTWindowType::Rectangular,
                FFTWindowType::Hann,
                FFTWindowType::Hamming,
                FFTWindowType::Blackman,
            ],
            supports_spectrogram: true,
            supports_harmonic_analysis: true,
        }
    }
}

/// DSP processor capabilities
pub struct DspCapabilities {
    pub max_fft_size: i32,
    pub min_fft_size: i32,
    pub supported_windows: Vec<FFTWindowType>,
    pub supports_spectrogram: bool,
    pub supports_harmonic_analysis: bool,
}

#[Object]
impl DspCapabilities {
    async fn max_fft_size(&self) -> i32 {
        self.max_fft_size
    }
    
    async fn min_fft_size(&self) -> i32 {
        self.min_fft_size
    }
    
    async fn supported_windows(&self) -> Vec<FFTWindowType> {
        self.supported_windows.clone()
    }
    
    async fn supports_spectrogram(&self) -> bool {
        self.supports_spectrogram
    }
    
    async fn supports_harmonic_analysis(&self) -> bool {
        self.supports_harmonic_analysis
    }
}

/// DSP Mutation Root - Processing operations
#[derive(Default)]
pub struct DspMutationRoot;

#[Object]
impl DspMutationRoot {
    /// Perform FFT analysis on audio samples
    async fn fft_analyze(
        &self,
        input: FFTAnalysisInput,
    ) -> FFTAnalysisResult {
        let sample_rate = input.sample_rate as f32;
        let samples = &input.samples;
        
        // Determine FFT size
        let fft_size = input.fft_size
            .map(|s| s as usize)
            .unwrap_or_else(|| samples.len().next_power_of_two());
        
        // Create FFT processor
        let mut fft = FftProcessor::new();
        
        // Compute magnitude spectrum
        let spectrum = fft.compute_magnitudes(samples, sample_rate);
        
        // Find peak
        let peak_result = fft.find_peak_frequency(
            samples, 
            sample_rate, 
            20.0,  // min freq
            sample_rate / 2.0  // max freq (Nyquist)
        );
        
        let (peak_freq, peak_mag) = peak_result.unwrap_or((0.0, -100.0));
        
        // Generate frequency bins
        let freq_resolution = sample_rate / fft_size as f32;
        let frequencies: Vec<f32> = (0..spectrum.len())
            .map(|i| i as f32 * freq_resolution)
            .collect();
        
        FFTAnalysisResult {
            frequencies,
            magnitudes_db: spectrum,
            peak_frequency: peak_freq,
            peak_magnitude_db: peak_mag,
            bins: fft_size as i32,
        }
    }
    
    /// Analyze waveform and compute measurements
    async fn analyze_waveform(
        &self,
        input: WaveformMeasurementInput,
    ) -> WaveformMeasurementResult {
        let sample_rate = input.sample_rate as f32;
        let analysis = analyze_waveform(&input.samples, sample_rate);
        
        WaveformMeasurementResult { analysis }
    }
    
    /// Compute spectrogram (waterfall display)
    async fn compute_spectrogram(
        &self,
        input: SpectrogramInput,
    ) -> SpectrogramResult {
        let sample_rate = input.sample_rate as u32;
        
        let config = SpectrogramConfig {
            window_size: input.window_size.unwrap_or(1024) as usize,
            overlap: input.overlap.unwrap_or(512) as usize,
            min_freq: input.min_freq.unwrap_or(0.0),
            max_freq: input.max_freq.unwrap_or(sample_rate as f32 / 2.0),
        };
        
        // Create a Waveform from the samples
        let waveform = Waveform::new(
            uuid::Uuid::new_v4().to_string(),
            "temp".to_string(),
            input.samples,
            Utc::now(),
        );
        
        let mut processor = SpectrogramProcessor::new();
        let spectrogram = processor.compute(&waveform, sample_rate, config);
        
        SpectrogramResult { spectrogram }
    }
    
    /// Analyze harmonic content
    async fn analyze_harmonics(
        &self,
        input: HarmonicAnalysisInput,
    ) -> HarmonicAnalysisResult {
        let sample_rate = input.sample_rate as f32;
        let _expected_fundamental = input.expected_fundamental
            .unwrap_or_else(|| analyze_waveform(&input.samples, sample_rate).dominant_frequency);
        
        // analyze_harmonics takes samples and sample_rate, derives fundamental from analysis
        let analysis = analyze_harmonics(&input.samples, sample_rate);
        
        HarmonicAnalysisResult { analysis }
    }
    
    /// Process audio with full DSP pipeline (FFT + Measurements + Spectrogram)
    async fn process_audio(
        &self,
        _ctx: &Context<'_>,
        scope_id: String,
        input: crate::api::schema_audio_input::AudioInput,
    ) -> FullDspResult {
        info!("DSP: Full processing for scope '{}' - {} samples at {}Hz", 
              scope_id, input.samples.len(), input.sample_rate);
        
        let sample_rate = input.sample_rate as u32;
        let sample_rate_f = sample_rate as f32;
        
        // Create waveform for spectrogram
        let waveform = Waveform::new(
            uuid::Uuid::new_v4().to_string(),
            scope_id.clone(),
            input.samples.clone(),
            Utc::now(),
        );
        
        // 1. FFT Analysis
        let mut fft = FftProcessor::new();
        let spectrum = fft.compute_magnitudes(&input.samples, sample_rate_f);
        let peak_result = fft.find_peak_frequency(
            &input.samples, sample_rate_f, 20.0, sample_rate_f / 2.0
        );
        let (peak_freq, peak_mag) = peak_result.unwrap_or((0.0, -100.0));
        
        // 2. Waveform Measurements
        let measurements = analyze_waveform(&input.samples, sample_rate_f);
        
        // 3. Spectrogram
        let spectrogram_config = SpectrogramConfig {
            window_size: 1024,
            overlap: 512,
            min_freq: 0.0,
            max_freq: sample_rate_f / 2.0,
        };
        let mut spectrogram_processor = SpectrogramProcessor::new();
        let spectrogram = spectrogram_processor.compute(&waveform, sample_rate, spectrogram_config);
        
        info!("DSP: Processing complete - Peak: {:.1}Hz, THD: {:.2}%, SNR: {:.1}dB",
              measurements.dominant_frequency, measurements.thd, measurements.snr);
        
        FullDspResult {
            measurements,
            spectrum: Spectrum {
                frequencies: spectrogram.frequencies.clone(),
                magnitudes_db: spectrum,
                phases: None,
                peak_frequency: peak_freq,
                peak_magnitude_db: peak_mag,
                sample_rate: sample_rate_f,
                window_size: 1024,
            },
            spectrogram,
        }
    }
}

/// Complete DSP processing result
pub struct FullDspResult {
    pub measurements: WaveformAnalysis,
    pub spectrum: Spectrum,
    pub spectrogram: SpectrogramData,
}

#[Object]
impl FullDspResult {
    /// Waveform measurements
    async fn measurements(&self) -> WaveformMeasurementResult {
        WaveformMeasurementResult { analysis: self.measurements.clone() }
    }
    
    /// Spectrum data
    async fn spectrum(&self) -> SpectrumResult {
        SpectrumResult { spectrum: self.spectrum.clone() }
    }
    
    /// Spectrogram data
    async fn spectrogram(&self) -> SpectrogramResult {
        SpectrogramResult { spectrogram: self.spectrogram.clone() }
    }
}

/// Simplified spectrum result
pub struct SpectrumResult {
    pub spectrum: Spectrum,
}

#[Object]
impl SpectrumResult {
    async fn frequencies(&self) -> Vec<f32> {
        self.spectrum.frequencies.clone()
    }
    
    async fn magnitudes_db(&self) -> Vec<f32> {
        self.spectrum.magnitudes_db.clone()
    }
    
    async fn peak_frequency(&self) -> f32 {
        self.spectrum.peak_frequency
    }
    
    async fn peak_magnitude_db(&self) -> f32 {
        self.spectrum.peak_magnitude_db
    }
}
