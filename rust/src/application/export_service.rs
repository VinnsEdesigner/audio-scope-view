use std::io::Write;

use crate::domain::{DomainResult, Waveform};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportFormat {
    Wav,
    Csv,
    Json,
}

impl ExportFormat {
    #[allow(clippy::should_implement_trait)]
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "wav" => Some(Self::Wav),
            "csv" => Some(Self::Csv),
            "json" => Some(Self::Json),
            _ => None,
        }
    }

    pub fn extension(&self) -> &'static str {
        match self {
            Self::Wav => "wav",
            Self::Csv => "csv",
            Self::Json => "json",
        }
    }

    pub fn mime_type(&self) -> &'static str {
        match self {
            Self::Wav => "audio/wav",
            Self::Csv => "text/csv; charset=utf-8",
            Self::Json => "application/json",
        }
    }
}

pub struct ExportService {
    default_sample_rate: u32,
}

impl ExportService {
    pub fn new(default_sample_rate: u32) -> Self {
        Self { default_sample_rate }
    }

    pub fn export(&self, waveform: &Waveform, format: ExportFormat) -> DomainResult<Vec<u8>> {
        match format {
            ExportFormat::Wav => self.export_wav(waveform),
            ExportFormat::Csv => self.export_csv(waveform),
            ExportFormat::Json => self.export_json(waveform),
        }
    }

    pub fn export_wav(&self, waveform: &Waveform) -> DomainResult<Vec<u8>> {
        let sample_rate = self.default_sample_rate;
        let num_channels = 1u16;
        let bits_per_sample = 16i16;
        let num_samples = waveform.samples.len() as u32;
        let data_size = num_samples * 2;

        let mut buffer = Vec::with_capacity(44 + data_size as usize);

        buffer.extend_from_slice(b"RIFF");
        buffer.extend_from_slice(&(36 + data_size).to_le_bytes());
        buffer.extend_from_slice(b"WAVE");

        buffer.extend_from_slice(b"fmt ");
        buffer.extend_from_slice(&16u32.to_le_bytes());
        buffer.extend_from_slice(&1u16.to_le_bytes());
        buffer.extend_from_slice(&num_channels.to_le_bytes());
        buffer.extend_from_slice(&sample_rate.to_le_bytes());
        buffer.extend_from_slice(&(sample_rate * num_channels as u32 * 2).to_le_bytes());
        buffer.extend_from_slice(&(num_channels * 2).to_le_bytes());
        buffer.extend_from_slice(&bits_per_sample.to_le_bytes());

        buffer.extend_from_slice(b"data");
        buffer.extend_from_slice(&data_size.to_le_bytes());

        for &sample in &waveform.samples {
            let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            buffer.extend_from_slice(&sample_i16.to_le_bytes());
        }

        Ok(buffer)
    }

    pub fn export_csv(&self, waveform: &Waveform) -> DomainResult<Vec<u8>> {
        let mut buffer = Vec::new();

        writeln!(&mut buffer, "index,timestamp_ms,sample")
            .map_err(|e| crate::domain::DomainError::InvalidOperation { message: e.to_string() })?;

        let start_ns = waveform.timestamp.timestamp_nanos_opt().unwrap_or(0) as f64;
        let sample_period_ns = 1_000_000_000.0 / self.default_sample_rate as f64;

        for (i, &sample) in waveform.samples.iter().enumerate() {
            let timestamp_ms = start_ns / 1_000_000.0 + (i as f64 * sample_period_ns / 1_000_000.0);
            writeln!(&mut buffer, "{},{:.6},{:.8}", i, timestamp_ms, sample)
                .map_err(|e| crate::domain::DomainError::InvalidOperation { message: e.to_string() })?;
        }

        Ok(buffer)
    }

    pub fn export_json(&self, waveform: &Waveform) -> DomainResult<Vec<u8>> {
        let export = ExportWaveformJson {
            id: &waveform.id,
            session_id: &waveform.session_id,
            timestamp: waveform.timestamp.to_rfc3339(),
            duration_ms: waveform.duration_ms,
            sample_rate: self.default_sample_rate,
            sample_count: waveform.samples.len(),
            peak_amplitude: waveform.peak_amplitude,
            rms_amplitude: waveform.rms_amplitude,
            samples: &waveform.samples,
        };

        let json = serde_json::to_string_pretty(&export)
            .map_err(|e| crate::domain::DomainError::InvalidOperation { message: e.to_string() })?;

        Ok(json.into_bytes())
    }
}

#[derive(serde::Serialize)]
struct ExportWaveformJson<'a> {
    id: &'a str,
    session_id: &'a str,
    timestamp: String,
    duration_ms: f64,
    sample_rate: u32,
    sample_count: usize,
    peak_amplitude: f32,
    rms_amplitude: f32,
    samples: &'a [f32],
}

// =============================================================================
// Streaming Export Service - For large recordings
// =============================================================================

pub struct StreamingExportService {
    default_sample_rate: u32,
    chunk_size: usize,
}

impl StreamingExportService {
    pub fn new(default_sample_rate: u32) -> Self {
        Self {
            default_sample_rate,
            chunk_size: 10_000,
        }
    }

    pub fn with_chunk_size(mut self, chunk_size: usize) -> Self {
        self.chunk_size = chunk_size;
        self
    }

    /// Get the WAV header for a given number of samples
    pub fn wav_header(&self, num_samples: usize) -> Vec<u8> {
        let sample_rate = self.default_sample_rate;
        let num_channels = 1u16;
        let bits_per_sample = 16i16;
        let num_samples_u32 = num_samples as u32;
        let data_size = num_samples_u32 * 2;

        let mut buffer = Vec::with_capacity(44);

        buffer.extend_from_slice(b"RIFF");
        buffer.extend_from_slice(&(36 + data_size).to_le_bytes());
        buffer.extend_from_slice(b"WAVE");

        buffer.extend_from_slice(b"fmt ");
        buffer.extend_from_slice(&16u32.to_le_bytes());
        buffer.extend_from_slice(&1u16.to_le_bytes());
        buffer.extend_from_slice(&num_channels.to_le_bytes());
        buffer.extend_from_slice(&sample_rate.to_le_bytes());
        buffer.extend_from_slice(&(sample_rate * num_channels as u32 * 2).to_le_bytes());
        buffer.extend_from_slice(&(num_channels * 2).to_le_bytes());
        buffer.extend_from_slice(&bits_per_sample.to_le_bytes());

        buffer.extend_from_slice(b"data");
        buffer.extend_from_slice(&data_size.to_le_bytes());

        buffer
    }

    /// Generate WAV file bytes (header + all samples)
    pub fn export_wav(&self, samples: &[f32]) -> DomainResult<Vec<u8>> {
        let mut buffer = self.wav_header(samples.len());

        for &sample in samples {
            let sample_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
            buffer.extend_from_slice(&sample_i16.to_le_bytes());
        }

        Ok(buffer)
    }

    /// Generate CSV header line
    pub fn csv_header() -> &'static str {
        "index,timestamp_ms,sample\n"
    }

    /// Generate a chunk of CSV lines
    pub fn csv_chunk(&self, samples: &[f32], start_index: usize, sample_rate: u32) -> String {
        let time_step_ms = 1000.0 / sample_rate as f64;
        let mut lines = Vec::with_capacity(samples.len().min(self.chunk_size));

        for (i, &sample) in samples.iter().enumerate() {
            let index = start_index + i;
            let timestamp_ms = index as f64 * time_step_ms;
            lines.push(format!("{},{:.6},{:.8}", index, timestamp_ms, sample));
        }

        lines.join("\n") + "\n"
    }

    /// Export CSV as a complete string
    pub fn export_csv(&self, samples: &[f32], sample_rate: u32) -> DomainResult<Vec<u8>> {
        let mut buffer = Vec::with_capacity(samples.len() * 30); // Approximate size

        buffer.extend_from_slice(Self::csv_header().as_bytes());
        
        // Process in chunks to avoid string concatenation overhead
        for chunk in samples.chunks(self.chunk_size) {
            let chunk_str = self.csv_chunk(chunk, 0, sample_rate);
            buffer.extend_from_slice(chunk_str.as_bytes());
        }

        Ok(buffer)
    }

    /// Export JSON
    pub fn export_json(&self, recording: &RecordingExportData) -> DomainResult<Vec<u8>> {
        let export = ExportWaveformJsonFull {
            id: &recording.id,
            session_id: &recording.session_id,
            name: &recording.name,
            timestamp: recording.timestamp.clone(),
            duration_ms: recording.duration_ms,
            sample_rate: self.default_sample_rate,
            sample_count: recording.samples.len(),
            peak_amplitude: recording.peak_amplitude,
            rms_amplitude: recording.rms_amplitude,
            samples: &recording.samples,
        };

        serde_json::to_string_pretty(&export)
            .map(|s| s.into_bytes())
            .map_err(|e| crate::domain::DomainError::InvalidOperation { message: e.to_string() })
    }
}

#[derive(serde::Serialize)]
struct ExportWaveformJsonFull<'a> {
    id: &'a str,
    session_id: &'a str,
    name: &'a str,
    timestamp: String,
    duration_ms: f64,
    sample_rate: u32,
    sample_count: usize,
    peak_amplitude: f32,
    rms_amplitude: f32,
    samples: &'a [f32],
}

/// Recording data for export (extracted from Recording domain object)
#[derive(Debug, Clone)]
pub struct RecordingExportData {
    pub id: String,
    pub session_id: String,
    pub name: String,
    pub samples: Vec<f32>,
    pub timestamp: String,
    pub duration_ms: f64,
    pub peak_amplitude: f32,
    pub rms_amplitude: f32,
}