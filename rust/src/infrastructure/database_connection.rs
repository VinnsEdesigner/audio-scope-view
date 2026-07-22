#![allow(dead_code)]
//! Database connection management

use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;

use crate::shared::error_app::{AppError, AppResult};

/// Database connection pool wrapper
#[derive(Clone)]
pub struct DatabaseConnection {
    pool: SqlitePool,
}

impl DatabaseConnection {
    /// Create a new database connection pool
    pub async fn new(database_url: &str) -> AppResult<Self> {
        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .min_connections(1)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .connect(database_url)
            .await
            .map_err(|e| AppError::database(&format!("Failed to create pool: {}", e)))?;

        Ok(Self { pool })
    }

    /// Create with in-memory SQLite (for testing)
    pub async fn in_memory() -> AppResult<Self> {
        Self::new("sqlite::memory:").await
    }

    /// Create with file-based SQLite
    pub async fn file(path: &str) -> AppResult<Self> {
        let url = format!("sqlite:{}?mode=rwc", path);
        Self::new(&url).await
    }

    /// Get the underlying pool
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// Run a transaction
    pub async fn transaction<F, T, E>(&self, f: F) -> Result<T, E>
    where
        F: FnOnce(&SqlitePool) -> Result<T, E>,
        E: From<sqlx::Error>,
    {
        let tx = self.pool.begin().await.map_err(E::from)?;

        let result = f(&self.pool);

        match result {
            Ok(v) => {
                tx.commit().await.map_err(E::from)?;
                Ok(v)
            }
            Err(e) => {
                tx.rollback().await.map_err(E::from)?;
                Err(e)
            }
        }
    }
}
