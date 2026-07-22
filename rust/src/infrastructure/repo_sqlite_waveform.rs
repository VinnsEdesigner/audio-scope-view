//! SQLite implementation of WaveformRepository

#![allow(dead_code)]
use chrono::{DateTime, Utc};
use serde_json;
use sqlx::{FromRow, SqlitePool};

use crate::domain::trait_waveform_repository::WaveformStatistics;
use crate::domain::{Waveform, error_domain::DomainError};

/// Raw waveform row from database
#[derive(FromRow)]
struct WaveformRow {
    id: String,
    scope_id: String,
    samples: String, // JSON array
    sample_count: i32,
    timestamp: String,
    duration_ms: f64,
    peak_amplitude: f32,
    rms_amplitude: f32,
    created_at: String,
}

impl TryFrom<WaveformRow> for Waveform {
    type Error = DomainError;

    fn try_from(row: WaveformRow) -> Result<Self, Self::Error> {
        let samples: Vec<f32> = serde_json::from_str(&row.samples)
            .map_err(|e| DomainError::corruption(format!("Invalid samples JSON: {}", e)))?;
        let timestamp = parse_datetime(&row.timestamp)?;

        Ok(Waveform {
            id: row.id,
            scope_id: row.scope_id,
            samples,
            timestamp,
            duration_ms: row.duration_ms,
            peak_amplitude: row.peak_amplitude,
            rms_amplitude: row.rms_amplitude,
        })
    }
}

/// Parse datetime from SQLite string
fn parse_datetime(s: &str) -> Result<DateTime<Utc>, DomainError> {
    DateTime::parse_from_rfc3339(s)
        .map(|dt| dt.with_timezone(&Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").map(|ndt| ndt.and_utc())
        })
        .map_err(|_| DomainError::corruption(format!("Invalid datetime format: {}", s)))
}

/// SQLite implementation of WaveformRepository
pub struct SqliteWaveformRepository {
    pool: SqlitePool,
}

impl SqliteWaveformRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    fn to_row(waveform: &Waveform) -> Result<WaveformRow, DomainError> {
        let samples_json = serde_json::to_string(&waveform.samples)
            .map_err(|e| DomainError::corruption(format!("Failed to serialize samples: {}", e)))?;

        Ok(WaveformRow {
            id: waveform.id.clone(),
            scope_id: waveform.scope_id.clone(),
            samples: samples_json,
            sample_count: waveform.samples.len() as i32,
            timestamp: waveform.timestamp.to_rfc3339(),
            duration_ms: waveform.duration_ms,
            peak_amplitude: waveform.peak_amplitude,
            rms_amplitude: waveform.rms_amplitude,
            created_at: Utc::now().to_rfc3339(),
        })
    }

    pub async fn save(&self, waveform: &Waveform) -> Result<(), DomainError> {
        let row = SqliteWaveformRepository::to_row(waveform)?;
        sqlx::query(
            r#"
            INSERT INTO waveforms (
                id, scope_id, samples, sample_count, timestamp, 
                duration_ms, peak_amplitude, rms_amplitude, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&row.id)
        .bind(&row.scope_id)
        .bind(&row.samples)
        .bind(row.sample_count)
        .bind(&row.timestamp)
        .bind(row.duration_ms)
        .bind(row.peak_amplitude)
        .bind(row.rms_amplitude)
        .bind(&row.created_at)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<Waveform>, DomainError> {
        let row: Option<WaveformRow> = sqlx::query_as("SELECT * FROM waveforms WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn find_by_scope(
        &self,
        scope_id: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<Waveform>, DomainError> {
        let rows: Vec<WaveformRow> = sqlx::query_as(
            r#"
            SELECT * FROM waveforms 
            WHERE scope_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ? OFFSET ?
            "#,
        )
        .bind(scope_id)
        .bind(limit as i32)
        .bind(offset as i32)
        .fetch_all(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        rows.into_iter().map(TryInto::try_into).collect()
    }

    pub async fn find_recent(
        &self,
        scope_id: &str,
        limit: u32,
    ) -> Result<Vec<Waveform>, DomainError> {
        self.find_by_scope(scope_id, limit, 0).await
    }

    pub async fn count_by_scope(&self, scope_id: &str) -> Result<u64, DomainError> {
        let row: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM waveforms WHERE scope_id = ?")
            .bind(scope_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(row.0 as u64)
    }

    pub async fn delete_by_scope(&self, scope_id: &str) -> Result<u64, DomainError> {
        let result = sqlx::query("DELETE FROM waveforms WHERE scope_id = ?")
            .bind(scope_id)
            .execute(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(result.rows_affected() as u64)
    }

    pub async fn delete_older_than(&self, before: DateTime<Utc>) -> Result<u64, DomainError> {
        let result = sqlx::query("DELETE FROM waveforms WHERE timestamp < ?")
            .bind(before.to_rfc3339())
            .execute(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(result.rows_affected() as u64)
    }

    pub async fn get_statistics(&self, scope_id: &str) -> Result<WaveformStatistics, DomainError> {
        let row: Option<WaveformStatsRow> = sqlx::query_as(
            r#"
            SELECT 
                COUNT(*) as total_count,
                SUM(sample_count) as total_samples,
                AVG(peak_amplitude) as avg_peak,
                AVG(rms_amplitude) as avg_rms
            FROM waveforms 
            WHERE scope_id = ?
            "#,
        )
        .bind(scope_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        Ok(row
            .map(|r| WaveformStatistics {
                total_count: r.total_count as u64,
                total_samples: r.total_samples.unwrap_or(0) as u64,
                average_peak: r.avg_peak.unwrap_or(0.0),
                average_rms: r.avg_rms.unwrap_or(0.0),
            })
            .unwrap_or_default())
    }
}

#[derive(Debug, FromRow)]
struct WaveformStatsRow {
    total_count: i64,
    total_samples: Option<i64>,
    avg_peak: Option<f32>,
    avg_rms: Option<f32>,
}

fn map_sqlx_err(e: sqlx::Error) -> DomainError {
    DomainError::repository(format!("Database error: {}", e))
}
