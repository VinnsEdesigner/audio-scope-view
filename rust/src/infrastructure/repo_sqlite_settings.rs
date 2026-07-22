//! SQLite implementation of SettingsRepository

#![allow(dead_code)]
use chrono::{DateTime, Utc};
use sqlx::{FromRow, SqlitePool};

use crate::domain::{Settings, TriggerEdge, TriggerMode, error_domain::DomainError};

/// Raw settings row from database
#[derive(FromRow)]
struct SettingsRow {
    id: String,
    scope_id: String,
    time_scale: f64,
    voltage_scale: f64,
    time_offset: f64,
    voltage_offset: f64,
    trigger_level: f64,
    trigger_mode: String,
    trigger_edge: String,
    show_grid: i32,
    show_measurements: i32,
    grid_divisions_x: i32,
    grid_divisions_y: i32,
    input_device: Option<String>,
    input_channels: i32,
    created_at: String,
    updated_at: String,
}

impl TryFrom<SettingsRow> for Settings {
    type Error = DomainError;

    fn try_from(row: SettingsRow) -> Result<Self, Self::Error> {
        let created_at = parse_datetime(&row.created_at)?;
        let updated_at = parse_datetime(&row.updated_at)?;
        let trigger_mode = TriggerMode::from_str(&row.trigger_mode).ok_or_else(|| {
            DomainError::corruption(format!("Invalid trigger mode: {}", row.trigger_mode))
        })?;
        let trigger_edge = TriggerEdge::from_str(&row.trigger_edge).ok_or_else(|| {
            DomainError::corruption(format!("Invalid trigger edge: {}", row.trigger_edge))
        })?;

        Ok(Self {
            id: row.id,
            scope_id: row.scope_id,
            time_scale: row.time_scale,
            voltage_scale: row.voltage_scale,
            time_offset: row.time_offset,
            voltage_offset: row.voltage_offset,
            trigger_level: row.trigger_level,
            trigger_mode,
            trigger_edge,
            show_grid: row.show_grid != 0,
            show_measurements: row.show_measurements != 0,
            grid_divisions_x: row.grid_divisions_x as u32,
            grid_divisions_y: row.grid_divisions_y as u32,
            input_device: row.input_device,
            input_channels: row.input_channels as u32,
            created_at,
            updated_at,
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

/// SQLite implementation of SettingsRepository
pub struct SqliteSettingsRepository {
    pool: SqlitePool,
}

impl SqliteSettingsRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    async fn to_row(settings: &Settings) -> SettingsRow {
        SettingsRow {
            id: settings.id.clone(),
            scope_id: settings.scope_id.clone(),
            time_scale: settings.time_scale,
            voltage_scale: settings.voltage_scale,
            time_offset: settings.time_offset,
            voltage_offset: settings.voltage_offset,
            trigger_level: settings.trigger_level,
            trigger_mode: settings.trigger_mode.as_str().to_string(),
            trigger_edge: settings.trigger_edge.as_str().to_string(),
            show_grid: if settings.show_grid { 1 } else { 0 },
            show_measurements: if settings.show_measurements { 1 } else { 0 },
            grid_divisions_x: settings.grid_divisions_x as i32,
            grid_divisions_y: settings.grid_divisions_y as i32,
            input_device: settings.input_device.clone(),
            input_channels: settings.input_channels as i32,
            created_at: settings.created_at.to_rfc3339(),
            updated_at: settings.updated_at.to_rfc3339(),
        }
    }
}

impl SqliteSettingsRepository {
    pub async fn save(&self, settings: &Settings) -> DomainErrorResult<()> {
        let row = Self::to_row(settings).await;
        sqlx::query(
            r#"
            INSERT INTO settings (
                id, scope_id, time_scale, voltage_scale, time_offset, voltage_offset,
                trigger_level, trigger_mode, trigger_edge, show_grid, show_measurements,
                grid_divisions_x, grid_divisions_y, input_device, input_channels,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&row.id)
        .bind(&row.scope_id)
        .bind(row.time_scale)
        .bind(row.voltage_scale)
        .bind(row.time_offset)
        .bind(row.voltage_offset)
        .bind(row.trigger_level)
        .bind(&row.trigger_mode)
        .bind(&row.trigger_edge)
        .bind(row.show_grid)
        .bind(row.show_measurements)
        .bind(row.grid_divisions_x)
        .bind(row.grid_divisions_y)
        .bind(&row.input_device)
        .bind(row.input_channels)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn update(&self, settings: &Settings) -> DomainErrorResult<()> {
        let row = Self::to_row(settings).await;
        sqlx::query(
            r#"
            UPDATE settings SET
                time_scale = ?, voltage_scale = ?, time_offset = ?, voltage_offset = ?,
                trigger_level = ?, trigger_mode = ?, trigger_edge = ?,
                show_grid = ?, show_measurements = ?,
                grid_divisions_x = ?, grid_divisions_y = ?,
                input_device = ?, input_channels = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(row.time_scale)
        .bind(row.voltage_scale)
        .bind(row.time_offset)
        .bind(row.voltage_offset)
        .bind(row.trigger_level)
        .bind(&row.trigger_mode)
        .bind(&row.trigger_edge)
        .bind(row.show_grid)
        .bind(row.show_measurements)
        .bind(row.grid_divisions_x)
        .bind(row.grid_divisions_y)
        .bind(&row.input_device)
        .bind(row.input_channels)
        .bind(&row.updated_at)
        .bind(&row.id)
        .execute(&self.pool)
        .await
        .map_err(map_sqlx_err)?;
        Ok(())
    }

    pub async fn find_by_id(&self, id: &str) -> DomainErrorResult<Option<Settings>> {
        let row: Option<SettingsRow> = sqlx::query_as("SELECT * FROM settings WHERE id = ?")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn find_by_scope_id(&self, scope_id: &str) -> DomainErrorResult<Option<Settings>> {
        let row: Option<SettingsRow> = sqlx::query_as("SELECT * FROM settings WHERE scope_id = ?")
            .bind(scope_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_err)?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    pub async fn delete(&self, id: &str) -> DomainErrorResult<bool> {
        let result = sqlx::query("DELETE FROM settings WHERE id = ?")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(result.rows_affected() > 0)
    }

    pub async fn delete_by_scope_id(&self, scope_id: &str) -> DomainErrorResult<bool> {
        let result = sqlx::query("DELETE FROM settings WHERE scope_id = ?")
            .bind(scope_id)
            .execute(&self.pool)
            .await
            .map_err(map_sqlx_err)?;
        Ok(result.rows_affected() > 0)
    }
}

type DomainErrorResult<T> = Result<T, DomainError>;

fn map_sqlx_err(e: sqlx::Error) -> DomainError {
    DomainError::repository(format!("Database error: {}", e))
}
