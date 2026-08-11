#![allow(dead_code)]

use crate::domain::DomainResult;
use crate::domain::trait_waveform_repository::{WaveformRepository, WaveformStatistics};
use crate::domain::{Waveform, error_domain::DomainError};
use crate::infrastructure::turso_http_client::{TursoArg, TursoClient, TursoResult};
use chrono::{DateTime, Utc};
use serde_json;

pub struct TursoWaveformRepository {
    client: TursoClient,
}

impl TursoWaveformRepository {
    pub fn new(client: TursoClient) -> Self {
        Self { client }
    }

    fn map_err(e: crate::shared::error_app::AppError) -> DomainError {
        DomainError::repository(format!("Database error: {}", e))
    }

    fn parse_datetime(s: &str) -> Result<DateTime<Utc>, DomainError> {
        DateTime::parse_from_rfc3339(s)
            .map(|dt| dt.with_timezone(&Utc))
            .or_else(|_| {
                chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S")
                    .map(|ndt| ndt.and_utc())
            })
            .map_err(|_| DomainError::corruption(format!("Invalid datetime format: {}", s)))
    }

    fn row_to_waveform(
        row: &[crate::infrastructure::turso_http_client::TursoValue],
    ) -> Result<Waveform, DomainError> {
        // Columns: id, session_id, samples, sample_count, timestamp,
        //          duration_ms, peak_amplitude, rms_amplitude, created_at
        let samples_str = row
            .get(2)
            .and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing samples".to_string()))?;
        let samples: Vec<f32> = serde_json::from_str(samples_str)
            .map_err(|e| DomainError::corruption(format!("Invalid samples JSON: {}", e)))?;
        let timestamp_str = row
            .get(4)
            .and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing timestamp".to_string()))?;

        Ok(Waveform {
            id: row
                .first()
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string(),
            session_id: row
                .get(1)
                .and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing session_id".to_string()))?
                .to_string(),
            samples,
            timestamp: Self::parse_datetime(timestamp_str)?,
            duration_ms: row.get(5).and_then(|v| v.as_f64()).unwrap_or(0.0),
            peak_amplitude: row.get(6).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            rms_amplitude: row.get(7).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
        })
    }

    fn collect_waveforms(
        result: &crate::infrastructure::turso_http_client::TursoResponse,
    ) -> Result<Vec<Waveform>, DomainError> {
        let mut waveforms = Vec::new();
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                waveforms.push(Self::row_to_waveform(row)?);
            }
        }
        Ok(waveforms)
    }

    fn first_row(
        result: &crate::infrastructure::turso_http_client::TursoResponse,
    ) -> Result<Option<Waveform>, DomainError> {
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
        {
            return Ok(Some(Self::row_to_waveform(row)?));
        }
        Ok(None)
    }
}

#[async_trait::async_trait]
impl WaveformRepository for TursoWaveformRepository {
    async fn save(&self, waveform: &Waveform) -> DomainResult<()> {
        let samples_json = serde_json::to_string(&waveform.samples)
            .map_err(|e| DomainError::corruption(format!("Failed to serialize samples: {}", e)))?;
        let created_at = Utc::now().to_rfc3339();

        let sql = r#"INSERT INTO waveforms (
            id, session_id, samples, sample_count, timestamp,
            duration_ms, peak_amplitude, rms_amplitude, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"#;

        self.client
            .execute_void_with_args(
                sql,
                vec![
                    TursoArg::text(&waveform.id),
                    TursoArg::text(&waveform.session_id),
                    TursoArg::text(samples_json),
                    (waveform.samples.len() as i32).into(),
                    TursoArg::text(waveform.timestamp.to_rfc3339()),
                    waveform.duration_ms.into(),
                    waveform.peak_amplitude.into(),
                    waveform.rms_amplitude.into(),
                    TursoArg::text(created_at),
                ],
            )
            .await
            .map_err(Self::map_err)
    }

    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Waveform>> {
        let sql = "SELECT * FROM waveforms WHERE id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(id)])
            .await
            .map_err(Self::map_err)?;
        Self::first_row(&result)
    }

    async fn find_by_session(
        &self,
        session_id: &str,
        limit: u32,
        offset: u32,
    ) -> DomainResult<Vec<Waveform>> {
        let sql =
            "SELECT * FROM waveforms WHERE session_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?";
        let result = self
            .client
            .execute_with_args(
                sql,
                vec![TursoArg::text(session_id), limit.into(), offset.into()],
            )
            .await
            .map_err(Self::map_err)?;
        Self::collect_waveforms(&result)
    }

    async fn find_recent(&self, session_id: &str, limit: u32) -> DomainResult<Vec<Waveform>> {
        self.find_by_session(session_id, limit, 0).await
    }

    async fn count_by_session(&self, session_id: &str) -> DomainResult<u64> {
        let sql = "SELECT COUNT(*) FROM waveforms WHERE session_id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(session_id)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
            && let Some(count) = row.first().and_then(|v| v.as_i64())
        {
            return Ok(count as u64);
        }
        Ok(0)
    }

    async fn delete_by_session(&self, session_id: &str) -> DomainResult<u64> {
        let sql = "DELETE FROM waveforms WHERE session_id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(session_id)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            Ok(ok.response.result.rows_written as u64)
        } else {
            Ok(0)
        }
    }

    async fn delete_older_than(&self, before: DateTime<Utc>) -> DomainResult<u64> {
        let sql = "DELETE FROM waveforms WHERE timestamp < ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(before.to_rfc3339())])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            Ok(ok.response.result.rows_written as u64)
        } else {
            Ok(0)
        }
    }

    async fn get_statistics(&self, session_id: &str) -> DomainResult<WaveformStatistics> {
        let sql = "SELECT COUNT(*), COALESCE(SUM(sample_count), 0), COALESCE(AVG(peak_amplitude), 0), COALESCE(AVG(rms_amplitude), 0) FROM waveforms WHERE session_id = ?";
        let result = self
            .client
            .execute_with_args(sql, vec![TursoArg::text(session_id)])
            .await
            .map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first()
            && let Some(row) = ok.response.result.rows.first()
        {
            return Ok(WaveformStatistics {
                total_count: row.first().and_then(|v| v.as_i64()).unwrap_or(0) as u64,
                total_samples: row.get(1).and_then(|v| v.as_i64()).unwrap_or(0) as u64,
                average_peak: row.get(2).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
                average_rms: row.get(3).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            });
        }
        Ok(WaveformStatistics::default())
    }
}
