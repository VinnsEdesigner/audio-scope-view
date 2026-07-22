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
            Self::Csv => "text/csv",
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
            scope_id: &waveform.scope_id,
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
    scope_id: &'a str,
    timestamp: String,
    duration_ms: f64,
    sample_rate: u32,
    sample_count: usize,
    peak_amplitude: f32,
    rms_amplitude: f32,
    samples: &'a [f32],
}
