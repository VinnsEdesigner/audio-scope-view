#![allow(dead_code)]

use crate::domain::recording::{
    Recording, RecordingFilter, RecordingMetadata, RecordingStats, RecordingSummary, TimeRange,
};
use crate::domain::error_domain::DomainError;
use crate::infrastructure::repo_trait_recording::{DomainErrorResult, RecordingRepository};
use crate::infrastructure::turso_http_client::{TursoArg, TursoClient, TursoResult, TursoValue};
use chrono::{DateTime, Utc};
use serde_json;

/// Explicit column list matching the order expected by `row_to_recording`,
/// `row_to_metadata`, and `row_to_summary`. Using an explicit list instead of
/// `SELECT *` avoids column-order mismatches when columns are added via
/// `ALTER TABLE` (e.g. `sample_rate` added by migration 008).
const RECORDING_COLUMNS: &str = "id, session_id, name, samples, sample_count, sample_rate, timestamp, \
    duration_ms, size_bytes, peak_amplitude, rms_amplitude, is_pinned, created_at, \
    waveform_overview, peak_db, rms_db, peak_negative_db, dc_offset, \
    dominant_frequency, frequency_high, frequency_low, bit_depth";

pub struct TursoRecordingRepository {
    client: TursoClient,
}

impl TursoRecordingRepository {
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

    fn get_float(row: &[TursoValue], idx: usize) -> Option<f64> {
        row.get(idx).and_then(|v| v.as_f64())
    }

    fn row_to_recording(row: &[TursoValue]) -> Result<Recording, DomainError> {
        // Columns: id, session_id, name, samples, sample_count, sample_rate, timestamp,
        //          duration_ms, size_bytes, peak_amplitude, rms_amplitude,
        //          is_pinned, created_at, waveform_overview, peak_db, rms_db,
        //          peak_negative_db, dc_offset, dominant_frequency, frequency_high,
        //          frequency_low, bit_depth
        let samples_str = row.get(3).and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing samples".to_string()))?;
        let samples: Vec<f32> = serde_json::from_str(samples_str)
            .map_err(|e| DomainError::corruption(format!("Invalid samples JSON: {}", e)))?;
        let timestamp_str = row.get(6).and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing timestamp".to_string()))?;

        Ok(Recording {
            id: row.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string(),
            session_id: row.get(1).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing session_id".to_string()))?
                .to_string(),
            name: row.get(2).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing name".to_string()))?
                .to_string(),
            samples,
            sample_rate: row.get(5).and_then(|v| v.as_i64()).unwrap_or(44100) as u32,
            timestamp: Self::parse_datetime(timestamp_str)?,
            duration_ms: row.get(7).and_then(|v| v.as_f64()).unwrap_or(0.0),
            size_bytes: row.get(8).and_then(|v| v.as_i64()).unwrap_or(0) as u64,
            peak_amplitude: row.get(9).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            rms_amplitude: row.get(10).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            peak_db: Self::get_float(row, 14).unwrap_or(0.0) as f32,
            rms_db: Self::get_float(row, 15).unwrap_or(0.0) as f32,
            peak_negative_db: Self::get_float(row, 16).unwrap_or(0.0) as f32,
            dc_offset: Self::get_float(row, 17).unwrap_or(0.0) as f32,
            dominant_frequency: Self::get_float(row, 18).unwrap_or(0.0) as f32,
            frequency_high: Self::get_float(row, 19).unwrap_or(0.0) as f32,
            frequency_low: Self::get_float(row, 20).unwrap_or(0.0) as f32,
            bit_depth: row.get(21).and_then(|v| v.as_i64()).unwrap_or(32) as u8,
            is_pinned: row.get(11).and_then(|v| v.as_bool()).unwrap_or(false),
        })
    }

    fn row_to_summary(row: &[TursoValue]) -> Result<RecordingSummary, DomainError> {
        let timestamp_str = row.get(6).and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing timestamp".to_string()))?;

        Ok(RecordingSummary {
            id: row.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string(),
            session_id: row.get(1).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing session_id".to_string()))?
                .to_string(),
            name: row.get(2).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing name".to_string()))?
                .to_string(),
            sample_rate: row.get(5).and_then(|v| v.as_i64()).unwrap_or(44100) as u32,
            timestamp: Self::parse_datetime(timestamp_str)?,
            duration_ms: row.get(7).and_then(|v| v.as_f64()).unwrap_or(0.0),
            size_bytes: row.get(8).and_then(|v| v.as_i64()).unwrap_or(0) as u64,
            peak_amplitude: row.get(9).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            rms_amplitude: row.get(10).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            peak_db: Self::get_float(row, 14).unwrap_or(0.0) as f32,
            rms_db: Self::get_float(row, 15).unwrap_or(0.0) as f32,
            peak_negative_db: Self::get_float(row, 16).unwrap_or(0.0) as f32,
            dc_offset: Self::get_float(row, 17).unwrap_or(0.0) as f32,
            dominant_frequency: Self::get_float(row, 18).unwrap_or(0.0) as f32,
            frequency_high: Self::get_float(row, 19).unwrap_or(0.0) as f32,
            frequency_low: Self::get_float(row, 20).unwrap_or(0.0) as f32,
            bit_depth: row.get(21).and_then(|v| v.as_i64()).unwrap_or(32) as u8,
            is_pinned: row.get(11).and_then(|v| v.as_bool()).unwrap_or(false),
        })
    }

    fn row_to_metadata(row: &[TursoValue]) -> Result<RecordingMetadata, DomainError> {
        let timestamp_str = row.get(5).and_then(|v| v.as_str())
            .ok_or_else(|| DomainError::corruption("Missing timestamp".to_string()))?;
        let waveform_overview = row.get(13).and_then(|v| v.as_str())
            .map(|json| serde_json::from_str(json))
            .transpose()
            .map_err(|e| DomainError::corruption(format!("Invalid waveform_overview JSON: {}", e)))?;

        Ok(RecordingMetadata {
            id: row.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string(),
            session_id: row.get(1).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing session_id".to_string()))?
                .to_string(),
            name: row.get(2).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing name".to_string()))?
                .to_string(),
            sample_count: row.get(4).and_then(|v| v.as_i64()).unwrap_or(0) as usize,
            sample_rate: row.get(5).and_then(|v| v.as_i64()).unwrap_or(44100) as u32,
            timestamp: Self::parse_datetime(timestamp_str)?,
            duration_ms: row.get(7).and_then(|v| v.as_f64()).unwrap_or(0.0),
            size_bytes: row.get(8).and_then(|v| v.as_i64()).unwrap_or(0) as u64,
            peak_amplitude: row.get(9).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            rms_amplitude: row.get(10).and_then(|v| v.as_f64()).unwrap_or(0.0) as f32,
            peak_db: Self::get_float(row, 14).unwrap_or(0.0) as f32,
            rms_db: Self::get_float(row, 15).unwrap_or(0.0) as f32,
            peak_negative_db: Self::get_float(row, 16).unwrap_or(0.0) as f32,
            dc_offset: Self::get_float(row, 17).unwrap_or(0.0) as f32,
            dominant_frequency: Self::get_float(row, 18).unwrap_or(0.0) as f32,
            frequency_high: Self::get_float(row, 19).unwrap_or(0.0) as f32,
            frequency_low: Self::get_float(row, 20).unwrap_or(0.0) as f32,
            bit_depth: row.get(21).and_then(|v| v.as_i64()).unwrap_or(32) as u8,
            is_pinned: row.get(11).and_then(|v| v.as_bool()).unwrap_or(false),
            waveform_overview,
        })
    }

    fn build_waveform_overview(samples: &[f32], max_points: usize) -> Option<String> {
        if samples.is_empty() {
            return None;
        }
        let overview = if samples.len() <= max_points {
            samples.to_vec()
        } else {
            let chunk_size = (samples.len() as f64 / max_points as f64).ceil() as usize;
            let mut overview: Vec<f32> = Vec::with_capacity(max_points * 2);
            for chunk in samples.chunks(chunk_size) {
                if chunk.is_empty() {
                    break;
                }
                let mut min_val = f32::MAX;
                let mut max_val = f32::MIN;
                for &sample in chunk {
                    min_val = min_val.min(sample);
                    max_val = max_val.max(sample);
                }
                overview.push(min_val);
                overview.push(max_val);
            }
            if overview.len() > max_points * 2 {
                overview.truncate(max_points * 2);
            }
            overview
        };
        serde_json::to_string(&overview).ok()
    }

    /// Build (where_clause, args) for a recording filter, using `?` placeholders.
    /// Returns a WHERE clause starting with " WHERE ..." (or empty string if no filter).
    fn build_where_clause(filter: Option<&RecordingFilter>) -> (String, Vec<TursoArg>) {
        let Some(f) = filter else {
            return (String::new(), Vec::new());
        };
        let mut clauses: Vec<String> = Vec::new();
        let mut args: Vec<TursoArg> = Vec::new();

        if let Some(ref session_id) = f.session_id {
            clauses.push("session_id = ?".to_string());
            args.push(TursoArg::text(session_id));
        }
        if let Some(pinned) = f.is_pinned {
            clauses.push("is_pinned = ?".to_string());
            args.push(TursoArg::bool(pinned));
        }
        if let Some(ref search) = f.search_query {
            clauses.push("name LIKE ?".to_string());
            args.push(TursoArg::text(format!("%{}%", search)));
        }
        if let Some(time_range) = f.time_range {
            if let Some(start) = Self::get_time_range_start(time_range) {
                clauses.push("timestamp >= ?".to_string());
                args.push(TursoArg::text(start.to_rfc3339()));
            }
        }

        let where_str = if clauses.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", clauses.join(" AND "))
        };
        (where_str, args)
    }

    fn get_time_range_start(range: TimeRange) -> Option<DateTime<Utc>> {
        let now = Utc::now();
        match range {
            TimeRange::Today => {
                Some(now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc())
            }
            TimeRange::LastWeek => Some(now - chrono::Duration::days(7)),
            TimeRange::LastMonth => Some(now - chrono::Duration::days(30)),
            TimeRange::AllTime => None,
        }
    }

    fn parse_stats_row(row: &[TursoValue]) -> RecordingStats {
        let total_recordings = row.get(0).and_then(|v| v.as_i64()).unwrap_or(0);
        let total_size_bytes = row.get(1).and_then(|v| v.as_i64()).unwrap_or(0);
        let total_duration_ms = row.get(2).and_then(|v| v.as_f64()).unwrap_or(0.0);
        let pinned_count = row.get(3).and_then(|v| v.as_i64()).unwrap_or(0);
        let count = total_recordings as f64;
        RecordingStats {
            total_recordings: total_recordings as u64,
            total_size_bytes: total_size_bytes as u64,
            total_duration_ms,
            average_size_bytes: if count > 0.0 { total_size_bytes as f64 / count } else { 0.0 },
            average_duration_ms: if count > 0.0 { total_duration_ms / count } else { 0.0 },
            pinned_count: pinned_count as u64,
        }
    }

    fn stats_sql() -> &'static str {
        r#"SELECT
            COUNT(*),
            COALESCE(SUM(size_bytes), 0),
            COALESCE(SUM(duration_ms), 0),
            COALESCE(SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END), 0)
            FROM recordings WHERE 1=1"#
    }
}

#[async_trait::async_trait]
impl RecordingRepository for TursoRecordingRepository {
    async fn save(&self, recording: &Recording) -> DomainErrorResult<()> {
        let samples_json = serde_json::to_string(&recording.samples)
            .unwrap_or_else(|_| "[]".to_string());
        let waveform_overview = Self::build_waveform_overview(&recording.samples, 1000);
        let created_at = Utc::now().to_rfc3339();

        let sql = r#"INSERT INTO recordings (
            id, session_id, name, samples, sample_count, sample_rate, timestamp,
            duration_ms, size_bytes, peak_amplitude, rms_amplitude,
            is_pinned, created_at, waveform_overview,
            peak_db, rms_db, peak_negative_db, dc_offset,
            dominant_frequency, frequency_high, frequency_low, bit_depth
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#;

        self.client.execute_void_with_args(sql, vec![
            TursoArg::text(&recording.id),
            TursoArg::text(&recording.session_id),
            TursoArg::text(&recording.name),
            TursoArg::text(samples_json),
            (recording.samples.len() as i32).into(),
            recording.sample_rate.into(),
            TursoArg::text(recording.timestamp.to_rfc3339()),
            recording.duration_ms.into(),
            (recording.size_bytes as i64).into(),
            recording.peak_amplitude.into(),
            recording.rms_amplitude.into(),
            TursoArg::bool(recording.is_pinned),
            TursoArg::text(created_at),
            TursoArg::opt_text(waveform_overview),
            recording.peak_db.into(),
            recording.rms_db.into(),
            recording.peak_negative_db.into(),
            recording.dc_offset.into(),
            recording.dominant_frequency.into(),
            recording.frequency_high.into(),
            recording.frequency_low.into(),
            recording.bit_depth.into(),
        ]).await.map_err(Self::map_err)
    }

    async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Recording>> {
        let sql = format!("SELECT {} FROM recordings WHERE id = ?", RECORDING_COLUMNS);
        let result = self.client.execute_with_args(&sql, vec![TursoArg::text(id)])
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                return Ok(Some(Self::row_to_recording(row)?));
            }
        }
        Ok(None)
    }

    async fn find_metadata_by_id(&self, id: &str) -> DomainErrorResult<Option<RecordingMetadata>> {
        let sql = format!("SELECT {} FROM recordings WHERE id = ?", RECORDING_COLUMNS);
        let result = self.client.execute_with_args(&sql, vec![TursoArg::text(id)])
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                return Ok(Some(Self::row_to_metadata(row)?));
            }
        }
        Ok(None)
    }

    async fn list(
        &self,
        filter: Option<&RecordingFilter>,
        limit: u32,
        offset: u32,
    ) -> DomainErrorResult<(Vec<RecordingSummary>, u64, bool)> {
        let (where_clause, mut args) = Self::build_where_clause(filter);

        // Count query
        let count_sql = format!("SELECT COUNT(*) FROM recordings{}", where_clause);
        let count_result = self.client.execute_with_args(&count_sql, args.clone())
            .await.map_err(Self::map_err)?;
        let mut total: u64 = 0;
        if let Some(TursoResult::Ok(ok)) = count_result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                total = row.first().and_then(|v| v.as_i64()).unwrap_or(0) as u64;
            }
        }

        // Main query — append LIMIT/OFFSET args
        let main_sql = format!(
            "SELECT {} FROM recordings{} ORDER BY is_pinned DESC, timestamp DESC LIMIT ? OFFSET ?",
            RECORDING_COLUMNS, where_clause
        );
        args.push(limit.into());
        args.push(offset.into());
        let result = self.client.execute_with_args(&main_sql, args)
            .await.map_err(Self::map_err)?;
        let mut recordings = Vec::new();
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                recordings.push(Self::row_to_summary(row)?);
            }
        }

        let has_more = (offset as u64 + limit as u64) < total;
        Ok((recordings, total, has_more))
    }

    async fn get_recent(&self, limit: u32) -> DomainErrorResult<Vec<RecordingSummary>> {
        let sql = format!("SELECT {} FROM recordings ORDER BY is_pinned DESC, timestamp DESC LIMIT ?", RECORDING_COLUMNS);
        let result = self.client.execute_with_args(&sql, vec![limit.into()])
            .await.map_err(Self::map_err)?;
        let mut recordings = Vec::new();
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            for row in &ok.response.result.rows {
                recordings.push(Self::row_to_summary(row)?);
            }
        }
        Ok(recordings)
    }

    async fn update(&self, recording: &Recording) -> DomainErrorResult<()> {
        let sql = "UPDATE recordings SET name = ?, is_pinned = ? WHERE id = ?";
        self.client.execute_void_with_args(sql, vec![
            TursoArg::text(&recording.name),
            TursoArg::bool(recording.is_pinned),
            TursoArg::text(&recording.id),
        ]).await.map_err(Self::map_err)
    }

    async fn delete(&self, id: &str) -> DomainErrorResult<()> {
        let sql = "DELETE FROM recordings WHERE id = ?";
        self.client.execute_void_with_args(sql, vec![TursoArg::text(id)])
            .await.map_err(Self::map_err)
    }

    async fn delete_many(&self, ids: &[String]) -> DomainErrorResult<u64> {
        if ids.is_empty() {
            return Ok(0);
        }
        let placeholders: Vec<&str> = ids.iter().map(|_| "?").collect();
        let sql = format!("DELETE FROM recordings WHERE id IN ({})", placeholders.join(","));
        let args: Vec<TursoArg> = ids.iter().map(|id| TursoArg::text(id)).collect();
        let result = self.client.execute_with_args(&sql, args)
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            Ok(ok.response.result.rows_written as u64)
        } else {
            Ok(0)
        }
    }

    async fn count_by_scope(&self, session_id: &str) -> DomainErrorResult<u64> {
        let sql = "SELECT COUNT(*) FROM recordings WHERE session_id = ?";
        let result = self.client.execute_with_args(sql, vec![TursoArg::text(session_id)])
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                if let Some(count) = row.first().and_then(|v| v.as_i64()) {
                    return Ok(count as u64);
                }
            }
        }
        Ok(0)
    }

    async fn get_stats(
        &self,
        session_id: Option<&str>,
        time_range: Option<TimeRange>,
    ) -> DomainErrorResult<RecordingStats> {
        let mut where_clause = String::new();
        let mut args: Vec<TursoArg> = Vec::new();
        if let Some(range) = time_range {
            if let Some(start) = Self::get_time_range_start(range) {
                where_clause.push_str(" AND timestamp >= ?");
                args.push(TursoArg::text(start.to_rfc3339()));
            }
        }
        if let Some(sid) = session_id {
            where_clause.push_str(" AND session_id = ?");
            args.push(TursoArg::text(sid));
        }
        let sql = format!("{}{}", Self::stats_sql(), where_clause);
        let result = self.client.execute_with_args(&sql, args)
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                return Ok(Self::parse_stats_row(row));
            }
        }
        Ok(RecordingStats::default())
    }

    async fn get_recording_count_by_range(
        &self,
        session_id: Option<&str>,
    ) -> DomainErrorResult<RecordingStats> {
        let (where_clause, args) = match session_id {
            Some(sid) => (" AND session_id = ?".to_string(), vec![TursoArg::text(sid)]),
            None => (String::new(), Vec::new()),
        };
        let sql = format!("{}{}", Self::stats_sql(), where_clause);
        let result = self.client.execute_with_args(&sql, args)
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                return Ok(Self::parse_stats_row(row));
            }
        }
        Ok(RecordingStats::default())
    }
}
