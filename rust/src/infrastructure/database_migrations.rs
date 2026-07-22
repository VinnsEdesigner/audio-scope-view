//! Database migrations

use sqlx::{Executor, SqlitePool};
use tracing::info;

use crate::shared::error_app::{AppError, AppResult};

/// Migration definitions
pub struct Migration {
    pub version: i32,
    pub name: &'static str,
    pub sql: &'static str,
}

pub const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "create_scopes",
        sql: include_str!("../../migrations/001_create_scopes.sql"),
    },
    Migration {
        version: 2,
        name: "create_settings",
        sql: include_str!("../../migrations/002_create_settings.sql"),
    },
    Migration {
        version: 3,
        name: "create_waveforms",
        sql: include_str!("../../migrations/003_create_waveforms.sql"),
    },
];

/// Run all pending migrations
pub async fn run_migrations(pool: &SqlitePool) -> AppResult<()> {
    // Create migrations table if not exists
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
        // Check if already applied
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

        // Apply migration
        info!(
            "Applying migration v{}: {}",
            migration.version, migration.name
        );

        pool.execute(sqlx::query(migration.sql))
            .await
            .map_err(|e| AppError::database(&format!("Failed to apply migration: {}", e)))?;

        // Record migration
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
