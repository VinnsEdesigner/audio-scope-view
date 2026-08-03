#![allow(dead_code)]

use lz4::block::{compress, decompress};

#[derive(Debug, Clone)]
pub struct CompressionResult {
    pub compressed: Vec<u8>,
    pub original_size: usize,
    pub compressed_size: usize,
}

impl CompressionResult {
    pub fn ratio(&self) -> f32 {
        if self.original_size == 0 {
            return 0.0;
        }
        (1.0 - self.compressed_size as f32 / self.original_size as f32) * 100.0
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.compressed
    }
}

pub fn compress_samples(samples: &[f32]) -> Result<CompressionResult, CompressionError> {
    if samples.is_empty() {
        return Ok(CompressionResult {
            compressed: Vec::new(),
            original_size: 0,
            compressed_size: 0,
        });
    }

    let original_bytes: Vec<u8> = samples
        .iter()
        .flat_map(|s| s.to_le_bytes())
        .collect();

    let original_size = original_bytes.len();

    let compressed = compress(&original_bytes, None, false)
        .map_err(|e| CompressionError::EncodeError(e.to_string()))?;
    
    let compressed_size = compressed.len();

    Ok(CompressionResult {
        compressed,
        original_size,
        compressed_size,
    })
}

pub fn decompress_samples(compressed: &[u8], sample_count: usize) -> Result<Vec<f32>, CompressionError> {
    if compressed.is_empty() {
        return Ok(Vec::new());
    }

    let expected_bytes = sample_count * 4; // f32 is 4 bytes

    let decompressed = decompress(compressed, Some(expected_bytes as i32))
        .map_err(|e| CompressionError::DecodeError(e.to_string()))?;

    if decompressed.len() != expected_bytes {
        return Err(CompressionError::InvalidData(format!(
            "Expected {} bytes, got {}",
            expected_bytes,
            decompressed.len()
        )));
    }

    let samples: Vec<f32> = decompressed
        .as_chunks::<4>()
        .0
        .iter()
        .map(|chunk| f32::from_le_bytes(*chunk))
        .collect();

    Ok(samples)
}

pub fn compress_waveform(samples: &[f32]) -> Result<CompressedWaveform, CompressionError> {
    let result = compress_samples(samples)?;
    
    Ok(CompressedWaveform {
        data: result.compressed,
        sample_count: samples.len(),
        original_size: result.original_size,
        compressed_size: result.compressed_size,
    })
}

pub fn decompress_waveform(waveform: &CompressedWaveform) -> Result<Vec<f32>, CompressionError> {
    decompress_samples(&waveform.data, waveform.sample_count)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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
        self.compression_ratio() > 10.0 // Only store compressed if >10% savings
    }
}

#[derive(Debug, thiserror::Error)]
pub enum CompressionError {
    #[error("Encode error: {0}")]
    EncodeError(String),
    
    #[error("Decode error: {0}")]
    DecodeError(String),
    
    #[error("Invalid data: {0}")]
    InvalidData(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compress_decompress() {
        let samples: Vec<f32> = (0..1000)
            .map(|i| (i as f32 * 0.01).sin() * 0.5)
            .collect();
        
        let result = compress_samples(&samples).unwrap();
        eprintln!("Original: {} bytes, Compressed: {} bytes, Ratio: {:.1}%", 
            result.original_size, result.compressed_size, result.ratio());
        
        let decompressed = decompress_samples(&result.compressed, samples.len()).unwrap();
        
        assert_eq!(decompressed.len(), samples.len());
        for (a, b) in samples.iter().zip(decompressed.iter()) {
            assert!((a - b).abs() < 1e-6, "Mismatch: {} vs {}", a, b);
        }
    }

    #[test]
    fn test_compression_result() {
        let samples: Vec<f32> = vec![0.1, 0.2, 0.3, 0.4, 0.5];
        let result = compress_samples(&samples).unwrap();
        
        assert_eq!(result.original_size, 20); // 5 f32s * 4 bytes
        eprintln!("Compression ratio: {:.1}%", result.ratio());
    }

    #[test]
    fn test_empty_samples() {
        let samples: Vec<f32> = vec![];
        let result = compress_samples(&samples).unwrap();
        
        assert!(result.compressed.is_empty());
        assert_eq!(result.original_size, 0);
    }

    #[test]
    fn test_compressed_waveform() {
        let samples: Vec<f32> = (0..4096)
            .map(|i| (i as f32 * 0.01).sin())
            .collect();
        
        let compressed = compress_waveform(&samples).unwrap();
        
        eprintln!("Compression ratio: {:.1}%", compressed.compression_ratio());
        eprintln!("Original: {} bytes, Compressed: {} bytes", 
            compressed.original_size, compressed.compressed_size);
        
        let decompressed = decompress_waveform(&compressed).unwrap();
        assert_eq!(decompressed.len(), samples.len());
        
        for (i, (a, b)) in samples.iter().zip(decompressed.iter()).enumerate() {
            assert!((a - b).abs() < 1e-6, "Mismatch at {}: {} vs {}", i, a, b);
        }
    }
}
