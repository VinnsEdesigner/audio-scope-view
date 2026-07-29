//! SQLite implementation of RecordingRepository

#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde_json;
use sqlx::{FromRow, SqlitePool};

use crate::domain::recording::{Recording, RecordingSummary, RecordingStats, RecordingFilter, TimeRange};
use crate::domain::error_domain::DomainError;

/// Raw recording row from database
#[derive(FromRow)]
struct RecordingRow {
    id: String,
    session_id: String,
    name: String,
    samples: String, // JSON array
    sample_count: i32,
    timestamp: String,
    duration_ms: f64,
    size_bytes: i64,
    peak_amplitude: f32,
    rms_amplitude: f32,
    is_pinned: bool,
    created_at: String,
}

impl TryFrom<RecordingRow> for Recording {
    type Error = DomainError;

    fn try_from(row: RecordingRow) -> Result<Self, Self::Error> {
        let samples: Vec<f32> = serde_json::from_str(&row.samples)
            .map_err(|e| DomainError::corruption(format!("Invalid samples JSON: {}", e)))?;
        let timestamp = parse_datetime(&row.timestamp)?;

        Ok(Recording {
            id: row.id,
            session_id: row.session_id,
            name: row.name,
            samples,
            timestamp,
            duration_ms: row.duration_ms,
            size_bytes: row.size_bytes as u64,
            peak_amplitude: row.peak_amplitude,
            rms_amplitude: row.rms_amplitude,
            is_pinned: row.is_pinned,
        })
    }
}

impl From<Recording> for RecordingRow {
    fn from(recording: Recording) -> Self {
        let samples_json = serde_json::to_string(&recording.samples).unwrap_or_else(|_| "[]".to_string());
        Self {
            id: recording.id,
            session_id: recording.session_id,
            name: recording.name,
            samples: samples_json,
            sample_count: recording.samples.len() as i32,
            timestamp: recording.timestamp.to_rfc3339(),
            duration_ms: recording.duration_ms,
            size_bytes: recording.size_bytes as i64,
            peak_amplitude: recording.peak_amplitude,
            rms_amplitude: recording.rms_amplitude,
            is_pinned: recording.is_pinned,
            created_at: Utc::now().to_rfc3339(),
        }
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

/// SQLite implementation of RecordingRepository
pub struct SqliteRecordingRepository {
    pool: SqlitePool,
}

impl SqliteRecordingRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn save(&self, recording: &Recording) -> Result<(), DomainError> {
        let row = RecordingRow::from(recording.clone());
        sqlx::query(
            r#"
            INSERT INTO recordings (
                id, session_id, name, samples, sample_count, timestamp, 
                duration_ms, size_bytes, peak_amplitude, rms_amplitude, 
                is_pinned, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&row.id)
        .bind(&row.session_id)
        .bind(&row.name)
        .bind(&row.samples)
        .bind(row.sample_count)
        .bind(&row.timestamp)
        .bind(row.duration_ms)
        .bind(row.size_bytes)
        .bind(row.peak_amplitude)
        .bind(row.rms_amplitude)
        .bind(row.is_pinned)
        .bind(&row.created_at)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<Recording>, DomainError> {
        let row: Option<RecordingRow> = sqlx::query_as("SELECT * FROM recordings WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn list(
        &self,
        filter: Option<&RecordingFilter>,
        limit: u32,
        offset: u32,
    ) -> Result<(Vec<RecordingSummary>, u64, bool), DomainError> {
        // Build query dynamically
        let (where_clause, params): (String, Vec<String>) = if let Some(f) = filter {
            let mut clauses = vec![];
            let mut params = vec![];

            if let Some(ref session_id) = f.session_id {
                clauses.push("session_id = ?".to_string());
                params.push(session_id.clone());
            }
            if let Some(pinned) = f.is_pinned {
                clauses.push("is_pinned = ?".to_string());
                params.push(if pinned { "1" } else { "0" }.to_string());
            }
            if let Some(ref search) = f.search_query {
                clauses.push("name LIKE ?".to_string());
                params.push(format!("%{}%", search));
            }
            if let Some(time_range) = f.time_range {
                let (start, _) = get_time_range_bounds(time_range);
                if let Some(start) = start {
                    clauses.push("timestamp >= ?".to_string());
                    params.push(start.to_rfc3339());
                }
            }

            let where_str = if clauses.is_empty() {
                String::new()
            } else {
                format!(" WHERE {}", clauses.join(" AND "))
            };
            (where_str, params)
        } else {
            (String::new(), vec![])
        };

        // Count query
        let count_sql = format!("SELECT COUNT(*) FROM recordings{}", where_clause);
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        for param in &params {
            count_query = count_query.bind(param);
        }
        let total = count_query
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        // Main query
        let main_sql = format!(
            "SELECT * FROM recordings{} ORDER BY is_pinned DESC, timestamp DESC LIMIT ? OFFSET ?",
            where_clause
        );
        let mut main_query = sqlx::query_as::<_, RecordingRow>(&main_sql);
        for param in &params {
            main_query = main_query.bind(param);
        }
        main_query = main_query.bind(limit as i32);
        main_query = main_query.bind(offset as i32);

        let rows: Vec<RecordingRow> = main_query
            .fetch_all(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        let recordings: Vec<RecordingSummary> = rows
            .into_iter()
            .map(|r| -> Result<RecordingSummary, DomainError> {
                Ok(RecordingSummary {
                    id: r.id,
                    session_id: r.session_id,
                    name: r.name,
                    timestamp: parse_datetime(&r.timestamp)?,
                    duration_ms: r.duration_ms,
                    size_bytes: r.size_bytes as u64,
                    peak_amplitude: r.peak_amplitude,
                    rms_amplitude: r.rms_amplitude,
                    is_pinned: r.is_pinned,
                })
            })
            .collect::<Result<Vec<RecordingSummary>, DomainError>>()?;

        let has_more = (offset as u64 + limit as u64) < total as u64;
        Ok((recordings, total as u64, has_more))
    }

    pub async fn get_recent(&self, limit: u32) -> Result<Vec<RecordingSummary>, DomainError> {
        let rows: Vec<RecordingRow> = sqlx::query_as(
            r#"
            SELECT * FROM recordings 
            ORDER BY is_pinned DESC, timestamp DESC 
            LIMIT ?
            "#,
        )
        .bind(limit as i32)
        .fetch_all(&self.pool)
        .await
        .map_err(map_sqlx_err)?;

        rows.into_iter()
            .map(|r| {
                Ok(RecordingSummary {
                    id: r.id,
                    session_id: r.session_id,
                    name: r.name,
                    timestamp: parse_datetime(&r.timestamp)?,
                    duration_ms: r.duration_ms,
                    size_bytes: r.size_bytes as u64,
                    peak_amplitude: r.peak_amplitude,
                    rms_amplitude: r.rms_amplitude,
                    is_pinned: r.is_pinned,
                })
            })
            .collect()
    }

    pub async fn update(&self, recording: &Recording) -> Result<(), DomainError> {
        sqlx::query(
            r#"
            UPDATE recordings SET 
                name = ?, is_pinned = ?
            WHERE id = ?
            "#,
        )
        .bind(&recording.name)
        .bind(recording.is_pinned)
        .bind(&recording.id)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<(), DomainError> {
        sqlx::query("DELETE FROM recordings WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn delete_many(&self, ids: &[String]) -> Result<u64, DomainError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let placeholders: Vec<&str> = ids.iter().map(|_| "?").collect();
        let query = format!("DELETE FROM recordings WHERE id IN ({})", placeholders.join(","));
        let mut builder = sqlx::QueryBuilder::new(&query);
        for id in ids {
            builder.push_bind(id);
        }
        let result = builder.build().execute(&self.pool).await.map_err(map_sqlx_err)?;
        Ok(result.rows_affected())
    }

    pub async fn count_by_scope(&self, session_id: &str) -> Result<u64, DomainError> {
        let row: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM recordings WHERE session_id = ?"
        )
        .bind(session_id)
        .fetch_one(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(row.0 as u64)
    }

    pub async fn get_stats(
        &self,
        session_id: Option<&str>,
        time_range: Option<TimeRange>,
    ) -> Result<RecordingStats, DomainError> {
        // Build query dynamically
        let mut where_clause = String::new();
        let (start_time, _) = if let Some(range) = time_range {
            let bounds = get_time_range_bounds(range);
            if let Some(start) = bounds.0 {
                where_clause.push_str(" AND timestamp >= ?");
            }
            bounds
        } else {
            (None, None)
        };

        if session_id.is_some() {
            where_clause.push_str(" AND session_id = ?");
        }

        let sql = format!(
            r#"
            SELECT 
                COUNT(*) as total_recordings,
                COALESCE(SUM(size_bytes), 0) as total_size_bytes,
                COALESCE(SUM(duration_ms), 0) as total_duration_ms,
                COALESCE(SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END), 0) as pinned_count
            FROM recordings WHERE 1=1{}
            "#,
            where_clause
        );

        let mut query = sqlx::query_as::<_, RecordingStatsRow>(&sql);
        
        if let Some(sid) = session_id {
            query = query.bind(sid);
        }
        if let Some(start) = start_time {
            query = query.bind(start.to_rfc3339());
        }

        let row: Option<RecordingStatsRow> = query
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        Ok(row.map(|r| {
            let count = r.total_recordings as f64;
            RecordingStats {
                total_recordings: r.total_recordings as u64,
                total_size_bytes: r.total_size_bytes as u64,
                total_duration_ms: r.total_duration_ms,
                average_size_bytes: if count > 0.0 { r.total_size_bytes as f64 / count } else { 0.0 },
                average_duration_ms: if count > 0.0 { r.total_duration_ms / count } else { 0.0 },
                pinned_count: r.pinned_count as u64,
            }
        }).unwrap_or_default())
    }

    pub async fn get_recording_count_by_range(
        &self,
        session_id: Option<&str>,
    ) -> Result<RecordingStats, DomainError> {
        let sql = if session_id.is_some() {
            "SELECT COUNT(*) as total_recordings, COALESCE(SUM(size_bytes), 0) as total_size_bytes, COALESCE(SUM(duration_ms), 0) as total_duration_ms, COALESCE(SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END), 0) as pinned_count FROM recordings WHERE session_id = ?"
        } else {
            "SELECT COUNT(*) as total_recordings, COALESCE(SUM(size_bytes), 0) as total_size_bytes, COALESCE(SUM(duration_ms), 0) as total_duration_ms, COALESCE(SUM(CASE WHEN is_pinned = 1 THEN 1 ELSE 0 END), 0) as pinned_count FROM recordings"
        };

        let mut query = sqlx::query_as::<_, RecordingStatsRow>(sql);
        
        if let Some(sid) = session_id {
            query = query.bind(sid);
        }

        let row: Option<RecordingStatsRow> = query
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        Ok(row.map(|r| {
            let count = r.total_recordings as f64;
            RecordingStats {
                total_recordings: r.total_recordings as u64,
                total_size_bytes: r.total_size_bytes as u64,
                total_duration_ms: r.total_duration_ms,
                average_size_bytes: if count > 0.0 { r.total_size_bytes as f64 / count } else { 0.0 },
                average_duration_ms: if count > 0.0 { r.total_duration_ms / count } else { 0.0 },
                pinned_count: r.pinned_count as u64,
            }
        }).unwrap_or_default())
    }
}

#[derive(Debug, FromRow)]
struct RecordingStatsRow {
    total_recordings: i64,
    total_size_bytes: i64,
    total_duration_ms: f64,
    pinned_count: i64,
}

fn get_time_range_bounds(range: TimeRange) -> (Option<DateTime<Utc>>, Option<DateTime<Utc>>) {
    let now = Utc::now();
    match range {
        TimeRange::Today => {
            let start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();
            (Some(start), None)
        }
        TimeRange::LastWeek => {
            let start = now - chrono::Duration::days(7);
            (Some(start), None)
        }
        TimeRange::LastMonth => {
            let start = now - chrono::Duration::days(30);
            (Some(start), None)
        }
        TimeRange::AllTime => (None, None),
    }
}

fn map_sqlx_err(e: sqlx::Error) -> DomainError {
    DomainError::repository(format!("Database error: {}", e))
}
