//! Safe Rust wrappers over the C++ DSP core (C ABI).
//!
//! This is the single FFI seam on the Rust side. Every Rust caller that used to
//! import `crate::domain::fft_processor` / `measurements` / `spectrogram` /
//! `compression` now imports from here. The C++ core (compiled by `build.rs`)
//! is the one source of truth; the Rust DSP modules are deleted (Step 2 of the
//! architecture migration — see docs/ARCHITECTURE_IMPLEMENTATION_SPEC.md §E).
//!
//! The C ABI types (`as_spectrum`, `as_harmonic_analysis`, …) are defined in
//! `sdk/bindings/ffi/audioscope_ffi.h`. They are malloc'd by the C++ side and
//! released by the matching `*_free` call; the safe wrappers here own the
//! copies and turn them into owned Rust `Vec`s.

// This module is the stable FFI shim that keeps the pre-migration `domain`
// call surface (`amplitude_to_db`, `compute_rms`, the raw `as_*` ABI, …)
// compilable. Not every entry is exercised by the binary today; they stay so
// external callers and future resolver wiring keep working. Same for the
// opaque `CFft` handle, which is an intentional non-FFI-safe opaque pointer.
#![allow(dead_code, improper_ctypes)]

use std::ffi::CStr;
use std::os::raw::{c_char, c_int};

use crate::domain::dsp_types::{
    FrequencyComponent, HarmonicAnalysis, SpectrogramConfig, SpectrogramData, Spectrum,
    WaveformAnalysis, WindowType,
};

// --------------------------------------------------------------------- //
// Raw C ABI declarations (mirror sdk/bindings/ffi/audioscope_ffi.h)
// --------------------------------------------------------------------- //

#[repr(C)]
#[derive(Clone, Copy)]
struct Cf32Array {
    data: *const f32,
    len: usize,
}

impl Default for Cf32Array {
    fn default() -> Self {
        Self {
            data: std::ptr::null(),
            len: 0,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
struct Ci64Array {
    data: *const i64,
    len: usize,
}

impl Default for Ci64Array {
    fn default() -> Self {
        Self {
            data: std::ptr::null(),
            len: 0,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy)]
struct CBytes {
    data: *const u8,
    len: usize,
}

impl Default for CBytes {
    fn default() -> Self {
        Self {
            data: std::ptr::null(),
            len: 0,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct CSpectrum {
    frequencies: Cf32Array,
    magnitudes_db: Cf32Array,
    phases: Cf32Array,
    peak_frequency: f32,
    peak_magnitude_db: f32,
    sample_rate: f32,
    window_size: c_int,
    has_phases: c_int,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct CFrequencyComponent {
    frequency: f32,
    magnitude: f32,
    harmonic: u32,
    phase: f32,
}

impl Default for CFrequencyComponent {
    fn default() -> Self {
        Self {
            frequency: 0.0,
            magnitude: 0.0,
            harmonic: 1,
            phase: 0.0,
        }
    }
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct CHarmonicAnalysis {
    fundamental: CFrequencyComponent,
    harmonics_flat: Cf32Array,
    thd: f32,
    thdn: f32,
    signal_energy: f32,
    noise_energy: f32,
}

#[repr(C)]
#[derive(Clone, Copy)]
struct CSpectrogramConfig {
    window_size: c_int,
    overlap: c_int,
    min_freq: f32,
    max_freq: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct CSpectrogramData {
    frequencies: Cf32Array,
    time_bins: Ci64Array,
    magnitude_rows: *const Cf32Array,
    num_rows: usize,
    sample_rate: f32,
    window_size: c_int,
    overlap: c_int,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct CCompressedWaveform {
    data: CBytes,
    sample_count: usize,
    original_size: usize,
    compressed_size: usize,
}

// Opaque FFT processor handle.
#[repr(C)]
struct CFft;

unsafe extern "C" {
    fn as_fft_new() -> *mut CFft;
    fn as_fft_free(fft: *mut CFft);
    fn as_fft_compute_magnitudes(
        fft: *mut CFft,
        samples: *const f32,
        count: usize,
        sample_rate: f32,
    ) -> Cf32Array;
    fn as_fft_find_peak_frequency(
        fft: *mut CFft,
        samples: *const f32,
        count: usize,
        sample_rate: f32,
        min_freq: f32,
        max_freq: f32,
        out_freq: *mut f32,
        out_mag: *mut f32,
    ) -> c_int;
    fn as_fft_compute_spectrum(
        fft: *mut CFft,
        samples: *const f32,
        count: usize,
        sample_rate: f32,
        window: c_int,
    ) -> CSpectrum;
    fn as_spectrum_free(s: *mut CSpectrum);
    fn asf32_array_free(a: Cf32Array);
    fn asi64_array_free(a: Ci64Array);
    fn as_bytes_free(b: CBytes);

    fn as_analyze_waveform(
        samples: *const f32,
        count: usize,
        sample_rate: f32,
    ) -> CWaveformAnalysis;
    fn as_find_peak_amplitude(samples: *const f32, count: usize) -> f32;
    fn as_find_negative_peak_amplitude(samples: *const f32, count: usize) -> f32;
    fn as_compute_rms(samples: *const f32, count: usize) -> f32;
    fn as_compute_dc_offset(samples: *const f32, count: usize) -> f32;
    fn as_zero_crossing_rate(samples: *const f32, count: usize) -> f32;
    fn as_estimate_dominant_frequency(samples: *const f32, count: usize, sample_rate: f32) -> f32;

    fn as_amplitude_to_db(a: f32) -> f32;
    fn as_db_to_amplitude(db: f32) -> f32;
    fn as_peak_to_dbfs(p: f32) -> f32;
    fn as_rms_to_dbfs(r: f32) -> f32;
    fn as_dbfs_to_amplitude(dbfs: f32) -> f32;
    fn as_crest_factor_db(cf: f32) -> f32;
    fn as_snr_to_db(s: f32, n: f32) -> f32;

    fn as_analyze_harmonics(
        samples: *const f32,
        count: usize,
        sample_rate: f32,
    ) -> CHarmonicAnalysis;
    fn as_harmonic_analysis_free(h: *mut CHarmonicAnalysis);

    fn as_spectrogram_compute(
        samples: *const f32,
        count: usize,
        sample_rate: f32,
        config: CSpectrogramConfig,
        start_time_ms: i64,
    ) -> CSpectrogramData;
    fn as_spectrogram_free(s: *mut CSpectrogramData);

    fn as_compress_waveform(samples: *const f32, count: usize) -> CCompressedWaveform;
    fn as_decompress_waveform(
        data: *const u8,
        size: usize,
        sample_count: usize,
        out: *mut Cf32Array,
    ) -> c_int;
    fn as_compressed_waveform_free(c: *mut CCompressedWaveform);

    fn as_dsp_version() -> *const c_char;
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct CWaveformAnalysis {
    peak_amplitude: f32,
    negative_peak_amplitude: f32,
    rms_amplitude: f32,
    dc_offset: f32,
    crest_factor: f32,
    zero_crossing_rate: f32,
    dominant_frequency: f32,
    thd: f32,
    snr: f32,
}

// --------------------------------------------------------------------- //
// Safe conversions
// --------------------------------------------------------------------- //

unsafe fn cf32_to_vec(a: Cf32Array) -> Vec<f32> {
    // Copy only — does NOT free. The owning composite struct's `*_free` call
    // (as_spectrum_free / as_spectrogram_free / …) releases the C allocation.
    // For standalone arrays (harmonics_flat, compress out-param) the matching
    // `*_free` is called by the wrapper. This avoids a double-free between the
    // element copy and the composite free.
    if a.data.is_null() || a.len == 0 {
        return Vec::new();
    }
    let slice = unsafe { std::slice::from_raw_parts(a.data, a.len) };
    slice.to_vec()
}

unsafe fn ci64_to_vec(a: Ci64Array) -> Vec<i64> {
    if a.data.is_null() || a.len == 0 {
        return Vec::new();
    }
    let slice = unsafe { std::slice::from_raw_parts(a.data, a.len) };
    slice.to_vec()
}

unsafe fn cbytes_to_vec(b: CBytes) -> Vec<u8> {
    if b.data.is_null() || b.len == 0 {
        return Vec::new();
    }
    let slice = unsafe { std::slice::from_raw_parts(b.data, b.len) };
    slice.to_vec()
}

fn window_to_c(w: WindowType) -> c_int {
    match w {
        WindowType::Rectangular => 0,
        WindowType::Hann => 1,
        WindowType::Hamming => 2,
        WindowType::Blackman => 3,
    }
}

// --------------------------------------------------------------------- //
// Public safe API — mirrors the old `domain` module surface so callers
// swap `crate::domain::fft_processor::FftProcessor` → `dsp_ffi::FftProcessor`
// with no other changes.
// --------------------------------------------------------------------- //

/// Stateful FFT processor. Reuse across calls (owns the C++ scratch buffers).
pub struct FftProcessor {
    handle: *mut CFft,
}

impl Default for FftProcessor {
    fn default() -> Self {
        Self::new()
    }
}

impl FftProcessor {
    pub fn new() -> Self {
        Self {
            handle: unsafe { as_fft_new() },
        }
    }

    pub fn compute_magnitudes(&mut self, samples: &[f32], sample_rate: f32) -> Vec<f32> {
        let c = unsafe {
            as_fft_compute_magnitudes(self.handle, samples.as_ptr(), samples.len(), sample_rate)
        };
        let v = unsafe { cf32_to_vec(c) };
        // c is a standalone malloc'd array; free it now that we've copied.
        unsafe { asf32_array_free(c) };
        v
    }

    pub fn find_peak_frequency(
        &mut self,
        samples: &[f32],
        sample_rate: f32,
        min_freq: f32,
        max_freq: f32,
    ) -> Option<(f32, f32)> {
        let mut freq = 0.0f32;
        let mut mag = 0.0f32;
        let ok = unsafe {
            as_fft_find_peak_frequency(
                self.handle,
                samples.as_ptr(),
                samples.len(),
                sample_rate,
                min_freq,
                max_freq,
                &mut freq,
                &mut mag,
            )
        };
        if ok == 1 { Some((freq, mag)) } else { None }
    }

    pub fn compute_spectrum(
        &mut self,
        samples: &[f32],
        sample_rate: f32,
        window: WindowType,
    ) -> Spectrum {
        let raw = unsafe {
            as_fft_compute_spectrum(
                self.handle,
                samples.as_ptr(),
                samples.len(),
                sample_rate,
                window_to_c(window),
            )
        };
        let mut raw = raw; // for the free call
        let frequencies = unsafe { cf32_to_vec(raw.frequencies) };
        let magnitudes_db = unsafe { cf32_to_vec(raw.magnitudes_db) };
        let phases_vec = unsafe { cf32_to_vec(raw.phases) };
        let phases = if raw.has_phases != 0 {
            Some(phases_vec)
        } else {
            None
        };
        let spectrum = Spectrum {
            frequencies,
            magnitudes_db,
            phases,
            peak_frequency: raw.peak_frequency,
            peak_magnitude_db: raw.peak_magnitude_db,
            sample_rate: raw.sample_rate,
            window_size: raw.window_size as usize,
        };
        unsafe { as_spectrum_free(&mut raw) };
        spectrum
    }
}

impl Drop for FftProcessor {
    fn drop(&mut self) {
        unsafe { as_fft_free(self.handle) }
    }
}

// Send/Sync: the C++ FftProcessor holds non-atomic scratch buffers and is NOT
// internally synchronized. We mark it Send+Sync because every Rust access path
// guards it with a lock — `audio_stream_manager` wraps it in a `RwLock` and
// `schema_dsp` constructs a fresh processor per resolver call (never shared).
// The lock is what makes concurrent access sound; this impl just lets the type
// cross thread boundaries into the lock.
unsafe impl Send for FftProcessor {}
unsafe impl Sync for FftProcessor {}

// --------------------------------------------------------------------- //
// Time-domain measurements
// --------------------------------------------------------------------- //

pub fn analyze_waveform(samples: &[f32], sample_rate: f32) -> WaveformAnalysis {
    let raw = unsafe { as_analyze_waveform(samples.as_ptr(), samples.len(), sample_rate) };
    WaveformAnalysis {
        peak_amplitude: raw.peak_amplitude,
        rms_amplitude: raw.rms_amplitude,
        dominant_frequency: raw.dominant_frequency,
        thd: raw.thd,
        snr: raw.snr,
        crest_factor: raw.crest_factor,
        dc_offset: raw.dc_offset,
    }
}

pub fn find_peak_amplitude(samples: &[f32]) -> f32 {
    unsafe { as_find_peak_amplitude(samples.as_ptr(), samples.len()) }
}
pub fn find_negative_peak_amplitude(samples: &[f32]) -> f32 {
    unsafe { as_find_negative_peak_amplitude(samples.as_ptr(), samples.len()) }
}
pub fn compute_rms(samples: &[f32]) -> f32 {
    unsafe { as_compute_rms(samples.as_ptr(), samples.len()) }
}
pub fn compute_dc_offset(samples: &[f32]) -> f32 {
    unsafe { as_compute_dc_offset(samples.as_ptr(), samples.len()) }
}
pub fn zero_crossing_rate(samples: &[f32]) -> f32 {
    unsafe { as_zero_crossing_rate(samples.as_ptr(), samples.len()) }
}
pub fn estimate_dominant_frequency(samples: &[f32], sample_rate: f32) -> f32 {
    unsafe { as_estimate_dominant_frequency(samples.as_ptr(), samples.len(), sample_rate) }
}

pub fn amplitude_to_db(a: f32) -> f32 {
    unsafe { as_amplitude_to_db(a) }
}
pub fn db_to_amplitude(db: f32) -> f32 {
    unsafe { as_db_to_amplitude(db) }
}
pub fn peak_to_dbfs(p: f32) -> f32 {
    unsafe { as_peak_to_dbfs(p) }
}
pub fn rms_to_dbfs(r: f32) -> f32 {
    unsafe { as_rms_to_dbfs(r) }
}
pub fn dbfs_to_amplitude(dbfs: f32) -> f32 {
    unsafe { as_dbfs_to_amplitude(dbfs) }
}
pub fn crest_factor_db(cf: f32) -> f32 {
    unsafe { as_crest_factor_db(cf) }
}
pub fn snr_to_db(s: f32, n: f32) -> f32 {
    unsafe { as_snr_to_db(s, n) }
}

// --------------------------------------------------------------------- //
// Harmonic analysis
// --------------------------------------------------------------------- //

pub fn analyze_harmonics(samples: &[f32], sample_rate: f32) -> HarmonicAnalysis {
    let raw = unsafe { as_analyze_harmonics(samples.as_ptr(), samples.len(), sample_rate) };
    let mut raw = raw;
    let fundamental = FrequencyComponent {
        frequency: raw.fundamental.frequency,
        magnitude: raw.fundamental.magnitude,
        harmonic: raw.fundamental.harmonic,
        phase: raw.fundamental.phase,
    };
    // harmonics_flat.len is in f32 units; the C++ packed as_frequency_component
    // structs back-to-back. Reconstitute them.
    let harmonics = unsafe {
        if raw.harmonics_flat.data.is_null() || raw.harmonics_flat.len == 0 {
            Vec::new()
        } else {
            let n_structs = raw.harmonics_flat.len * std::mem::size_of::<f32>()
                / std::mem::size_of::<CFrequencyComponent>();
            let ptr = raw.harmonics_flat.data as *const CFrequencyComponent;
            let slice = std::slice::from_raw_parts(ptr, n_structs);
            slice
                .iter()
                .map(|c| FrequencyComponent {
                    frequency: c.frequency,
                    magnitude: c.magnitude,
                    harmonic: c.harmonic,
                    phase: c.phase,
                })
                .collect()
        }
    };
    let analysis = HarmonicAnalysis {
        fundamental,
        harmonics,
        thd: raw.thd,
        thdn: raw.thdn,
        signal_energy: raw.signal_energy,
        noise_energy: raw.noise_energy,
    };
    unsafe { as_harmonic_analysis_free(&mut raw) };
    analysis
}

// --------------------------------------------------------------------- //
// Spectrogram
// --------------------------------------------------------------------- //

pub fn compute_spectrogram(
    samples: &[f32],
    sample_rate: u32,
    config: SpectrogramConfig,
    start_time_ms: i64,
) -> SpectrogramData {
    let c_config = CSpectrogramConfig {
        window_size: config.window_size as c_int,
        overlap: config.overlap as c_int,
        min_freq: config.min_freq,
        max_freq: config.max_freq,
    };
    let raw = unsafe {
        as_spectrogram_compute(
            samples.as_ptr(),
            samples.len(),
            sample_rate as f32,
            c_config,
            start_time_ms,
        )
    };
    let mut raw = raw;
    let frequencies = unsafe { cf32_to_vec(raw.frequencies) };
    let time_bins = unsafe { ci64_to_vec(raw.time_bins) };
    let num_rows = raw.num_rows;
    let rows_ptr = raw.magnitude_rows;
    let magnitudes = unsafe {
        if rows_ptr.is_null() || num_rows == 0 {
            Vec::new()
        } else {
            let rows = std::slice::from_raw_parts(rows_ptr, num_rows);
            let mut out = Vec::with_capacity(num_rows);
            for row in rows {
                out.push(cf32_to_vec(*row));
            }
            out
        }
    };
    let data = SpectrogramData {
        frequencies,
        time_bins,
        magnitudes,
        sample_rate,
        window_size: config.window_size,
        overlap: config.overlap,
    };
    unsafe { as_spectrogram_free(&mut raw) };
    data
}

// --------------------------------------------------------------------- //
// Compression
// --------------------------------------------------------------------- //

pub struct CompressedWaveform {
    pub data: Vec<u8>,
    pub sample_count: usize,
    pub original_size: usize,
    pub compressed_size: usize,
}

impl CompressedWaveform {
    pub fn compression_ratio(&self) -> f32 {
        if self.original_size == 0 {
            return 0.0;
        }
        (1.0 - self.compressed_size as f32 / self.original_size as f32) * 100.0
    }
    pub fn should_compress(&self) -> bool {
        self.compression_ratio() > 10.0
    }
}

pub fn compress_waveform(samples: &[f32]) -> Option<CompressedWaveform> {
    let raw = unsafe { as_compress_waveform(samples.as_ptr(), samples.len()) };
    let mut raw = raw;
    let data = unsafe { cbytes_to_vec(raw.data) };
    let result = CompressedWaveform {
        data,
        sample_count: raw.sample_count,
        original_size: raw.original_size,
        compressed_size: raw.compressed_size,
    };
    unsafe { as_compressed_waveform_free(&mut raw) };
    Some(result)
}

pub fn decompress_waveform(data: &[u8], sample_count: usize) -> Option<Vec<f32>> {
    let mut out = Cf32Array {
        data: std::ptr::null(),
        len: 0,
    };
    let ok = unsafe { as_decompress_waveform(data.as_ptr(), data.len(), sample_count, &mut out) };
    if ok != 1 {
        return None;
    }
    let vec = unsafe { cf32_to_vec(out) };
    // out is a standalone malloc'd array (not owned by a composite struct), so
    // free it explicitly here.
    unsafe { asf32_array_free(out) };
    Some(vec)
}

// --------------------------------------------------------------------- //
// Version
// --------------------------------------------------------------------- //

pub fn dsp_version() -> &'static str {
    unsafe {
        let cstr = CStr::from_ptr(as_dsp_version());
        cstr.to_str()
            .unwrap_or("audio-scope-view DSP core (unknown)")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_is_nonempty() {
        assert!(!dsp_version().is_empty());
    }

    #[test]
    fn fft_sine_finds_peak() {
        let sr = 44100.0f32;
        let n = 4096;
        let samples: Vec<f32> = (0..n)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * (i as f32) / sr).sin() * 0.5)
            .collect();
        let mut fft = FftProcessor::new();
        let mags = fft.compute_magnitudes(&samples, sr);
        assert!(!mags.is_empty());
        let peak = fft.find_peak_frequency(&samples, sr, 20.0, sr / 2.0);
        assert!(peak.is_some());
        let (freq, _) = peak.unwrap();
        assert!(
            (freq - 440.0).abs() < 50.0,
            "peak {freq} should be near 440"
        );
    }

    #[test]
    fn analyze_waveform_sine() {
        let sr = 44100.0f32;
        let n = 4410;
        let samples: Vec<f32> = (0..n)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * (i as f32) / sr).sin() * 0.8)
            .collect();
        let a = analyze_waveform(&samples, sr);
        assert!((a.peak_amplitude - 0.8).abs() < 0.05);
        assert!((a.rms_amplitude - 0.565).abs() < 0.05);
    }

    #[test]
    fn compress_roundtrip() {
        let samples: Vec<f32> = (0..1000).map(|i| (i as f32) * 0.001).collect();
        let cw = compress_waveform(&samples).unwrap();
        let recovered = decompress_waveform(&cw.data, cw.sample_count).unwrap();
        assert_eq!(recovered.len(), samples.len());
        for (a, b) in samples.iter().zip(recovered.iter()) {
            assert!((a - b).abs() < 1e-6);
        }
    }
}
