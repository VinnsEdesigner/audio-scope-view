
use sqlx::{Executor, SqlitePool};
use tracing::info;

use crate::shared::error_app::{AppError, AppResult};

pub struct Migration {
    pub version: i32,
    pub name: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create_settings",
        sql: include_str!("../../migrations/002_create_settings.sql"),
    },
    Migration {
        version: 2,
        name: "create_waveforms",
        sql: include_str!("../../migrations/003_create_waveforms.sql"),
    },
    Migration {
        version: 3,
        name: "create_recordings",
        sql: include_str!("../../migrations/004_create_recordings.sql"),
    },
    Migration {
        version: 4,
        name: "create_sessions",
        sql: include_str!("../../migrations/005_create_sessions.sql"),
    },
    Migration {
        version: 5,
        name: "create_api_keys",
        sql: include_str!("../../migrations/006_create_api_keys.sql"),
    },
    Migration {
        version: 6,
        name: "add_waveform_overview",
        sql: include_str!("../../migrations/007_add_waveform_overview.sql"),
    },
    Migration {
        version: 7,
        name: "add_sample_rate_to_recordings",
        sql: include_str!("../../migrations/008_add_sample_rate_to_recordings.sql"),
    },
    Migration {
        version: 8,
        name: "add_oscilloscope_to_sessions",
        sql: include_str!("../../migrations/009_add_oscilloscope_to_sessions.sql"),
    },
    Migration {
        version: 9,
        name: "add_session_metadata",
        sql: include_str!("../../migrations/010_add_session_metadata.sql"),
    },
    Migration {
        version: 10,
        name: "create_user_preferences",
        sql: include_str!("../../migrations/011_create_user_preferences.sql"),
    },
    Migration {
        version: 11,
        name: "add_peak_negative_db_to_recordings",
        sql: include_str!("../../migrations/012_add_peak_negative_db_to_recordings.sql"),
    },
    Migration {
        version: 12,
        name: "add_audio_analysis_to_sessions",
        sql: include_str!("../../migrations/013_add_audio_analysis_to_sessions.sql"),
    },
    Migration {
        version: 14,
        name: "add_auto_close_timeout_to_sessions",
        sql: include_str!("../../migrations/014_add_auto_close_timeout_to_sessions.sql"),
    },
];

pub async fn run_migrations(pool: &SqlitePool) -> AppResult<()> {
    pool.execute(
        r#"
        CREATE TABLE IF NOT EXISTS _migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .await
    .map_err(|e| AppError::database(&format!("Failed to create migrations table: {}", e)))?;

    for migration in MIGRATIONS {
        let row: Option<(i32,)> =
            sqlx::query_as("SELECT version FROM _migrations WHERE version = ?")
                .bind(migration.version)
                .fetch_optional(pool)
                .await
                .map_err(|e| AppError::database(&format!("Failed to check migration: {}", e)))?;

        if row.is_some() {
            info!(
                "Migration v{} already applied: {}",
                migration.version, migration.name
            );
            continue;
        }

        info!(
            "Applying migration v{}: {}",
            migration.version, migration.name
        );

        pool.execute(sqlx::query(migration.sql))
            .await
            .map_err(|e| AppError::database(&format!("Failed to apply migration: {}", e)))?;

        sqlx::query("INSERT INTO _migrations (version, name) VALUES (?, ?)")
            .bind(migration.version)
            .bind(migration.name)
            .execute(pool)
            .await
            .map_err(|e| AppError::database(&format!("Failed to record migration: {}", e)))?;

        info!("Migration v{} applied successfully", migration.version);
    }

    Ok(())
}