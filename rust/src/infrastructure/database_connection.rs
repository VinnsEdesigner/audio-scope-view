#![allow(dead_code)]

use sqlx::SqlitePool;
use sqlx::sqlite::SqlitePoolOptions;

use crate::shared::error_app::{AppError, AppResult};

/// Database connection wrapper that supports both SQLite (local) and Turso (cloud)
pub enum DatabaseConnection {
    Sqlite(SqlitePool),
    Turso {
        url: String,
        token: String,
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

    /// Create Turso connection using HTTP API
    async fn new_turso(database_url: &str) -> AppResult<Self> {
        let auth_token = std::env::var("TURSO_VYZOR_SCOPE_DB_TOKEN")
            .map_err(|_| AppError::database("TURSO_VYZOR_SCOPE_DB_TOKEN environment variable not set"))?;

        // Test connection
        let client = reqwest::Client::new();
        let host = database_url.trim_start_matches("libsql://");
        let test_url = format!("https://{}", host);
        
        let response = client
            .post(&test_url)
            .header("Authorization", format!("Bearer {}", auth_token))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "statements": ["SELECT 1"]
            }))
            .send()
            .await
            .map_err(|e| AppError::database(&format!("Failed to connect to Turso: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::database(&format!(
                "Turso connection failed with status: {}", 
                response.status()
            )));
        }

        Ok(Self::Turso {
            url: test_url,
            token: auth_token,
        })
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

    /// Get the Turso database info (only works for Turso connections)
    pub fn turso_info(&self) -> Option<(&str, &str)> {
        match self {
            Self::Sqlite(_) => None,
            Self::Turso { url, token } => Some((url, token)),
        }
    }

    /// Execute a raw SQL query using Turso HTTP API
    pub async fn execute_raw(&self, sql: &str) -> AppResult<()> {
        match self {
            Self::Sqlite(pool) => {
                sqlx::query(sql)
                    .execute(pool)
                    .await
                    .map_err(|e| AppError::database(&format!("Failed to execute SQL: {}", e)))?;
            }
            Self::Turso { url, token } => {
                self.execute_turso(sql).await?;
            }
        }
        Ok(())
    }

    /// Execute SQL via Turso HTTP API.
    ///
    /// The Turso v1 REST API rejects SQL strings containing more than one
    /// statement, so multi-statement migration files are split on semicolons
    /// and sent as separate requests.
    async fn execute_turso(&self, sql: &str) -> AppResult<()> {
        let (url, token) = match self.turso_info() {
            Some(info) => info,
            None => return Err(AppError::database("Not a Turso connection")),
        };

        let stmts: Vec<&str> = sql
            .split(';')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        let client = reqwest::Client::new();
        for stmt in stmts {
            let response = client
                .post(url)
                .header("Authorization", format!("Bearer {}", token))
                .header("Content-Type", "application/json")
                .json(&serde_json::json!({
                    "statements": [stmt]
                }))
                .send()
                .await
                .map_err(|e| AppError::database(&format!("Failed to execute on Turso: {}", e)))?;

            if !response.status().is_success() {
                let status = response.status();
                let body = response.text().await.unwrap_or_default();
                return Err(AppError::database(&format!(
                    "Turso query failed with status {}: {}",
                    status, body
                )));
            }
        }

        Ok(())
    }

    /// Execute a parameterized SQL query
    pub async fn execute(&self, sql: &str) -> AppResult<()> {
        self.execute_raw(sql).await
    }
}