#![allow(dead_code)]

use crate::domain::{Settings, TriggerEdge, TriggerMode, error_domain::DomainError};
use crate::domain::trait_settings_repository::SettingsRepository;
use crate::domain::DomainResult;
use crate::infrastructure::turso_http_client::{TursoArg, TursoClient, TursoResult, TursoValue};
use chrono::{DateTime, Utc};

pub struct TursoSettingsRepository {
    client: TursoClient,
}

impl TursoSettingsRepository {
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

    fn row_to_settings(row: &[TursoValue]) -> Result<Settings, DomainError> {
        // Columns: id, session_id, time_scale, voltage_scale, time_offset, voltage_offset,
        //          trigger_level, trigger_mode, trigger_edge, show_grid, show_measurements,
        //          grid_divisions_x, grid_divisions_y, input_device, input_channels,
        //          created_at, updated_at
        let trigger_mode_str = row.get(7).and_then(|v| v.as_str()).unwrap_or("auto");
        let trigger_mode = TriggerMode::from_str(trigger_mode_str).ok_or_else(|| {
            DomainError::corruption(format!("Invalid trigger mode: {}", trigger_mode_str))
        })?;
        let trigger_edge_str = row.get(8).and_then(|v| v.as_str()).unwrap_or("rising");
        let trigger_edge = TriggerEdge::from_str(trigger_edge_str).ok_or_else(|| {
            DomainError::corruption(format!("Invalid trigger edge: {}", trigger_edge_str))
        })?;

        Ok(Settings {
            id: row.get(0).and_then(|v| v.as_str()).unwrap_or("").to_string(),
            session_id: row.get(1).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing session_id".to_string()))?
                .to_string(),
            time_scale: row.get(2).and_then(|v| v.as_f64()).unwrap_or(1.0),
            voltage_scale: row.get(3).and_then(|v| v.as_f64()).unwrap_or(1.0),
            time_offset: row.get(4).and_then(|v| v.as_f64()).unwrap_or(0.0),
            voltage_offset: row.get(5).and_then(|v| v.as_f64()).unwrap_or(0.0),
            trigger_level: row.get(6).and_then(|v| v.as_f64()).unwrap_or(0.0),
            trigger_mode,
            trigger_edge,
            show_grid: row.get(9).and_then(|v| v.as_bool()).unwrap_or(true),
            show_measurements: row.get(10).and_then(|v| v.as_bool()).unwrap_or(true),
            grid_divisions_x: row.get(11).and_then(|v| v.as_i64()).unwrap_or(10) as u32,
            grid_divisions_y: row.get(12).and_then(|v| v.as_i64()).unwrap_or(8) as u32,
            input_device: row.get(13).and_then(|v| v.as_str()).filter(|s| !s.is_empty()).map(String::from),
            input_channels: row.get(14).and_then(|v| v.as_i64()).unwrap_or(1) as u32,
            created_at: row.get(15).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing created_at".to_string()))
                .and_then(|s| Self::parse_datetime(s))?,
            updated_at: row.get(16).and_then(|v| v.as_str())
                .ok_or_else(|| DomainError::corruption("Missing updated_at".to_string()))
                .and_then(|s| Self::parse_datetime(s))?,
        })
    }

    fn first_row(result: &crate::infrastructure::turso_http_client::TursoResponse) -> Result<Option<Settings>, DomainError> {
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            if let Some(row) = ok.response.result.rows.first() {
                return Ok(Some(Self::row_to_settings(row)?));
            }
        }
        Ok(None)
    }
}

#[async_trait::async_trait]
impl SettingsRepository for TursoSettingsRepository {
    async fn save(&self, settings: &Settings) -> DomainResult<()> {
        let sql = r#"INSERT INTO settings (
            id, session_id, time_scale, voltage_scale, time_offset, voltage_offset,
            trigger_level, trigger_mode, trigger_edge, show_grid, show_measurements,
            grid_divisions_x, grid_divisions_y, input_device, input_channels,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"#;

        self.client.execute_void_with_args(sql, vec![
            TursoArg::text(&settings.id),
            TursoArg::text(&settings.session_id),
            settings.time_scale.into(),
            settings.voltage_scale.into(),
            settings.time_offset.into(),
            settings.voltage_offset.into(),
            settings.trigger_level.into(),
            TursoArg::text(settings.trigger_mode.as_str()),
            TursoArg::text(settings.trigger_edge.as_str()),
            TursoArg::bool(settings.show_grid),
            TursoArg::bool(settings.show_measurements),
            settings.grid_divisions_x.into(),
            settings.grid_divisions_y.into(),
            TursoArg::opt_text(settings.input_device.clone()),
            settings.input_channels.into(),
            TursoArg::text(settings.created_at.to_rfc3339()),
            TursoArg::text(settings.updated_at.to_rfc3339()),
        ]).await.map_err(Self::map_err)
    }

    async fn update(&self, settings: &Settings) -> DomainResult<()> {
        let sql = r#"UPDATE settings SET
            time_scale = ?, voltage_scale = ?, time_offset = ?, voltage_offset = ?,
            trigger_level = ?, trigger_mode = ?, trigger_edge = ?,
            show_grid = ?, show_measurements = ?,
            grid_divisions_x = ?, grid_divisions_y = ?,
            input_device = ?, input_channels = ?, updated_at = ?
            WHERE id = ?"#;

        self.client.execute_void_with_args(sql, vec![
            settings.time_scale.into(),
            settings.voltage_scale.into(),
            settings.time_offset.into(),
            settings.voltage_offset.into(),
            settings.trigger_level.into(),
            TursoArg::text(settings.trigger_mode.as_str()),
            TursoArg::text(settings.trigger_edge.as_str()),
            TursoArg::bool(settings.show_grid),
            TursoArg::bool(settings.show_measurements),
            settings.grid_divisions_x.into(),
            settings.grid_divisions_y.into(),
            TursoArg::opt_text(settings.input_device.clone()),
            settings.input_channels.into(),
            TursoArg::text(settings.updated_at.to_rfc3339()),
            TursoArg::text(&settings.id),
        ]).await.map_err(Self::map_err)
    }

    async fn find_by_id(&self, id: &str) -> DomainResult<Option<Settings>> {
        let sql = "SELECT * FROM settings WHERE id = ?";
        let result = self.client.execute_with_args(sql, vec![TursoArg::text(id)])
            .await.map_err(Self::map_err)?;
        Self::first_row(&result)
    }

    async fn find_by_session_id(&self, session_id: &str) -> DomainResult<Option<Settings>> {
        let sql = "SELECT * FROM settings WHERE session_id = ?";
        let result = self.client.execute_with_args(sql, vec![TursoArg::text(session_id)])
            .await.map_err(Self::map_err)?;
        Self::first_row(&result)
    }

    async fn delete(&self, id: &str) -> DomainResult<bool> {
        let sql = "DELETE FROM settings WHERE id = ?";
        let result = self.client.execute_with_args(sql, vec![TursoArg::text(id)])
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            Ok(ok.response.result.rows_written > 0)
        } else {
            Ok(false)
        }
    }

    async fn delete_by_session_id(&self, session_id: &str) -> DomainResult<bool> {
        let sql = "DELETE FROM settings WHERE session_id = ?";
        let result = self.client.execute_with_args(sql, vec![TursoArg::text(session_id)])
            .await.map_err(Self::map_err)?;
        if let Some(TursoResult::Ok(ok)) = result.results.first() {
            Ok(ok.response.result.rows_written > 0)
        } else {
            Ok(false)
        }
    }
}
