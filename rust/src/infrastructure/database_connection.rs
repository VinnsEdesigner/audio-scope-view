#![allow(dead_code)]

use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;
use libsql::Builder;

use crate::shared::error_app::{AppError, AppResult};

/// Database connection wrapper that supports both SQLite (local) and Turso (cloud)
pub enum DatabaseConnection {
    Sqlite(SqlitePool),
    Turso {
        db: libsql::Database,
    },
}

impl DatabaseConnection {
    /// Create a new database connection based on URL scheme
    /// Supports:
    /// - SQLite: `sqlite:./data/app.db?mode=rwc`
    /// - Turso/libsql: `libsql://your-db.turso.io`
    pub async fn new(database_url: &str) -> AppResult<Self> {
        if database_url.starts_with("libsql://") {
            Self::new_turso(database_url).await
        } else {
            Self::new_sqlite(database_url).await
        }
    }

    /// Create SQLite connection
    async fn new_sqlite(database_url: &str) -> AppResult<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .min_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .connect(database_url)
            .await
            .map_err(|e| AppError::database(&format!("Failed to create SQLite pool: {}", e)))?;

        Ok(Self::Sqlite(pool))
    }

    /// Create Turso/libsql connection
    async fn new_turso(database_url: &str) -> AppResult<Self> {
        let auth_token = std::env::var("TURSO_AUTH_TOKEN")
            .map_err(|_| AppError::database("TURSO_AUTH_TOKEN environment variable not set"))?;

        let db = Builder::new_remote(database_url.to_string(), auth_token)
            .build()
            .await
            .map_err(|e| AppError::database(&format!("Failed to create Turso connection: {}", e)))?;

        Ok(Self::Turso { db })
    }

    pub async fn in_memory() -> AppResult<Self> {
        Self::new_sqlite("sqlite::memory:").await
    }

    pub async fn file(path: &str) -> AppResult<Self> {
        let url = format!("sqlite:{}?mode=rwc", path);
        Self::new_sqlite(&url).await
    }

    /// Get the SQLite pool (only works for SQLite connections)
    pub fn sqlite_pool(&self) -> Option<&SqlitePool> {
        match self {
            Self::Sqlite(pool) => Some(pool),
            Self::Turso { .. } => None,
        }
    }

    /// Get the Turso database (only works for Turso connections)
    pub fn turso_db(&self) -> Option<&libsql::Database> {
        match self {
            Self::Sqlite(_) => None,
            Self::Turso { db } => Some(db),
        }
    }

    /// Execute a raw SQL query using Turso (for migrations, etc.)
    pub async fn execute_raw(&self, sql: &str) -> AppResult<()> {
        match self {
            Self::Sqlite(pool) => {
                sqlx::query(sql)
                    .execute(pool)
                    .await
                    .map_err(|e| AppError::database(&format!("Failed to execute SQL: {}", e)))?;
            }
            Self::Turso { db } => {
                let conn = db.connect()
                    .map_err(|e| AppError::database(&format!("Failed to get connection: {}", e)))?;
                conn.execute(sql, ())
                    .await
                    .map_err(|e| AppError::database(&format!("Failed to execute SQL: {}", e)))?;
            }
        }
        Ok(())
    }

    /// Execute a parameterized SQL query
    pub async fn execute(&self, sql: &str) -> AppResult<()> {
        match self {
            Self::Sqlite(pool) => {
                sqlx::query(sql)
                    .execute(pool)
                    .await
                    .map_err(|e| AppError::database(&format!("Failed to execute query: {}", e)))?;
            }
            Self::Turso { db } => {
                let conn = db.connect()
                    .map_err(|e| AppError::database(&format!("Failed to get connection: {}", e)))?;
                conn.execute(sql, ())
                    .await
                    .map_err(|e| AppError::database(&format!("Failed to execute query: {}", e)))?;
            }
        }
        Ok(())
    }
}