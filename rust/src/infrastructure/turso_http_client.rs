//! Turso HTTP Client for database operations
//! Uses the Turso HTTP API v2 to execute SQL queries
//!
//! Supports both raw SQL strings and parameterized queries with bound args.
//! Parameterized queries should be preferred to avoid SQL injection and
//! to ensure correct type handling for NULL, text, and numeric values.

// Wire model for the Turso HTTP API: every variant/field mirrors the response
// shape exactly (for forward-compat), and the client exposes a small surface
// (`execute_void`/`execute_batch`/`ping`, `is_null`) that the server may call
// as transport/storage grows. Keep them even when currently unused.
#![allow(dead_code)]

use crate::shared::error_app::{AppError, AppResult};
use serde::{Deserialize, Serialize};

/// A bound parameter value for parameterized queries.
///
/// Uses `?` positional placeholders in the SQL string. The Turso HTTP API
/// expects integer values as strings (matching SQLite's dynamic typing).
#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type")]
pub enum TursoArg {
    #[serde(rename = "text")]
    Text { value: String },
    #[serde(rename = "integer")]
    Integer { value: String },
    #[serde(rename = "float")]
    Float { value: f64 },
    #[serde(rename = "null")]
    Null,
    #[serde(rename = "blob")]
    Blob { value: String },
}

impl TursoArg {
    pub fn text<T: Into<String>>(v: T) -> Self {
        TursoArg::Text { value: v.into() }
    }

    pub fn integer(v: i64) -> Self {
        TursoArg::Integer {
            value: v.to_string(),
        }
    }

    pub fn float(v: f64) -> Self {
        // serde_json serializes NaN/Infinity as null, which Turso rejects for
        // NOT NULL columns. Sanitize non-finite values to 0.0.
        TursoArg::Float {
            value: if v.is_finite() { v } else { 0.0 },
        }
    }

    pub fn bool(v: bool) -> Self {
        TursoArg::Integer {
            value: if v { "1".into() } else { "0".into() },
        }
    }

    pub fn opt_text<T: Into<String>>(v: Option<T>) -> Self {
        match v {
            Some(val) => TursoArg::text(val),
            None => TursoArg::Null,
        }
    }

    pub fn opt_integer(v: Option<i64>) -> Self {
        match v {
            Some(val) => TursoArg::integer(val),
            None => TursoArg::Null,
        }
    }

    pub fn opt_float(v: Option<f64>) -> Self {
        match v {
            Some(val) => TursoArg::float(val),
            None => TursoArg::Null,
        }
    }

    pub fn opt_f32(v: Option<f32>) -> Self {
        match v {
            Some(val) => TursoArg::float(val as f64),
            None => TursoArg::Null,
        }
    }
}

// --- From impls for ergonomic conversion ---

impl From<&str> for TursoArg {
    fn from(v: &str) -> Self {
        TursoArg::text(v)
    }
}

impl From<String> for TursoArg {
    fn from(v: String) -> Self {
        TursoArg::text(v)
    }
}

impl From<&String> for TursoArg {
    fn from(v: &String) -> Self {
        TursoArg::text(v)
    }
}

impl From<i32> for TursoArg {
    fn from(v: i32) -> Self {
        TursoArg::integer(v as i64)
    }
}

impl From<i64> for TursoArg {
    fn from(v: i64) -> Self {
        TursoArg::integer(v)
    }
}

impl From<u32> for TursoArg {
    fn from(v: u32) -> Self {
        TursoArg::integer(v as i64)
    }
}

impl From<u64> for TursoArg {
    fn from(v: u64) -> Self {
        TursoArg::integer(v as i64)
    }
}

impl From<f32> for TursoArg {
    fn from(v: f32) -> Self {
        TursoArg::float(v as f64)
    }
}

impl From<f64> for TursoArg {
    fn from(v: f64) -> Self {
        TursoArg::float(v)
    }
}

impl From<bool> for TursoArg {
    fn from(v: bool) -> Self {
        TursoArg::bool(v)
    }
}

impl From<u8> for TursoArg {
    fn from(v: u8) -> Self {
        TursoArg::integer(v as i64)
    }
}

impl From<u16> for TursoArg {
    fn from(v: u16) -> Self {
        TursoArg::integer(v as i64)
    }
}

impl From<Option<&str>> for TursoArg {
    fn from(v: Option<&str>) -> Self {
        TursoArg::opt_text(v)
    }
}

impl From<Option<String>> for TursoArg {
    fn from(v: Option<String>) -> Self {
        TursoArg::opt_text(v)
    }
}

impl From<Option<i32>> for TursoArg {
    fn from(v: Option<i32>) -> Self {
        TursoArg::opt_integer(v.map(|x| x as i64))
    }
}

impl From<Option<i64>> for TursoArg {
    fn from(v: Option<i64>) -> Self {
        TursoArg::opt_integer(v)
    }
}

impl From<Option<f32>> for TursoArg {
    fn from(v: Option<f32>) -> Self {
        TursoArg::opt_f32(v)
    }
}

impl From<Option<f64>> for TursoArg {
    fn from(v: Option<f64>) -> Self {
        TursoArg::opt_float(v)
    }
}

/// Convenience: build a Vec<TursoArg> from a list of args.
#[macro_export]
macro_rules! turso_args {
    ($($arg:expr),* $(,)?) => {{
        let mut v: Vec<$crate::infrastructure::turso_http_client::TursoArg> = Vec::new();
        $(
            v.push($arg.into());
        )*
        v
    }};
}

/// Request structure for v2/pipeline endpoint
#[derive(Debug, Serialize)]
struct PipelineRequest {
    #[serde(rename = "type")]
    request_type: String,
    stmt: StmtRequest,
}

#[derive(Debug, Serialize)]
struct StmtRequest {
    sql: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    args: Option<Vec<TursoArg>>,
}

/// Response from Turso HTTP API v2
#[derive(Debug, Deserialize)]
pub struct TursoResponse {
    #[serde(rename = "results")]
    pub results: Vec<TursoResult>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
pub enum TursoResult {
    #[serde(rename = "ok")]
    Ok(TursoResultOk),
    #[serde(rename = "error")]
    Error { error: TursoError },
}

#[derive(Debug, Deserialize)]
pub struct TursoResultOk {
    #[serde(rename = "response")]
    pub response: TursoExecuteResponse,
}

#[derive(Debug, Deserialize)]
pub struct TursoExecuteResponse {
    #[serde(rename = "type")]
    pub response_type: String,
    #[serde(rename = "result")]
    pub result: TursoStmtResult,
}

#[derive(Debug, Deserialize)]
pub struct TursoStmtResult {
    #[serde(rename = "cols")]
    pub columns: Vec<TursoColumn>,
    #[serde(rename = "rows")]
    pub rows: Vec<Vec<TursoValue>>,
    #[serde(rename = "rows_read")]
    pub rows_read: i64,
    #[serde(rename = "rows_written")]
    pub rows_written: i64,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum TursoValue {
    #[serde(rename = "text")]
    Text { value: String },
    #[serde(rename = "integer")]
    Integer { value: String },
    #[serde(rename = "float")]
    Float { value: f64 },
    #[serde(rename = "null")]
    Null,
    #[serde(rename = "blob")]
    Blob { value: String },
}

impl TursoValue {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            TursoValue::Text { value } => Some(value),
            _ => None,
        }
    }

    pub fn as_i64(&self) -> Option<i64> {
        match self {
            TursoValue::Integer { value } => value.parse().ok(),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            TursoValue::Float { value } => Some(*value),
            TursoValue::Integer { value } => value.parse().ok(),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            TursoValue::Integer { value } => Some(value != "0"),
            _ => None,
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, TursoValue::Null)
    }
}

#[derive(Debug, Deserialize)]
pub struct TursoColumn {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct TursoError {
    pub message: String,
    #[serde(default)]
    pub code: Option<String>,
}

/// Turso HTTP Client
pub struct TursoClient {
    url: String,
    token: String,
    client: reqwest::Client,
}

impl TursoClient {
    /// Create a new Turso HTTP client
    pub fn new(url: &str, token: &str) -> Self {
        // Ensure URL ends with /v2/pipeline
        let base_url = if url.ends_with("/v2/pipeline") {
            url.to_string()
        } else {
            format!("{}/v2/pipeline", url.trim_end_matches('/'))
        };
        Self {
            url: base_url,
            token: token.to_string(),
            client: reqwest::Client::new(),
        }
    }

    /// Execute a raw SQL statement (no bound parameters).
    ///
    /// Prefer `execute_with_args` for any query that includes user-supplied values.
    pub async fn execute(&self, sql: &str) -> AppResult<TursoResponse> {
        self.send_request(sql, None).await
    }

    /// Execute a parameterized SQL statement with bound args (`?` placeholders).
    pub async fn execute_with_args(
        &self,
        sql: &str,
        args: Vec<TursoArg>,
    ) -> AppResult<TursoResponse> {
        self.send_request(sql, Some(args)).await
    }

    /// Core request sender shared by `execute` and `execute_with_args`.
    async fn send_request(
        &self,
        sql: &str,
        args: Option<Vec<TursoArg>>,
    ) -> AppResult<TursoResponse> {
        let request = PipelineRequest {
            request_type: "execute".to_string(),
            stmt: StmtRequest {
                sql: sql.to_string(),
                args,
            },
        };

        let response = self
            .client
            .post(&self.url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "requests": [request]
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

        let body = response
            .text()
            .await
            .map_err(|e| AppError::database(&format!("Failed to read response body: {}", e)))?;

        let result: TursoResponse = serde_json::from_str(&body).map_err(|e| {
            AppError::database(&format!(
                "Failed to parse Turso response: {} - body: {}",
                e, body
            ))
        })?;

        if let Some(TursoResult::Error { error: err }) = result.results.first() {
            return Err(AppError::database(&format!(
                "Turso SQL error: {}",
                err.message
            )));
        }

        Ok(result)
    }

    /// Execute a raw SQL statement without returning results (for INSERT/UPDATE/DELETE).
    pub async fn execute_void(&self, sql: &str) -> AppResult<()> {
        let result = self.execute(sql).await?;
        if let Some(TursoResult::Ok(ok_result)) = result.results.first()
            && (ok_result.response.result.rows_written > 0
                || ok_result.response.result.rows_read > 0)
        {
            return Ok(());
        }
        Ok(())
    }

    /// Execute a parameterized SQL statement without returning results.
    pub async fn execute_void_with_args(&self, sql: &str, args: Vec<TursoArg>) -> AppResult<()> {
        let result = self.execute_with_args(sql, args).await?;
        if let Some(TursoResult::Ok(ok_result)) = result.results.first()
            && (ok_result.response.result.rows_written > 0
                || ok_result.response.result.rows_read > 0)
        {
            return Ok(());
        }
        Ok(())
    }

    /// Execute multiple raw SQL statements.
    pub async fn execute_batch(&self, statements: &[&str]) -> AppResult<Vec<TursoResponse>> {
        let mut results = Vec::new();
        for sql in statements {
            let result = self.execute(sql).await?;
            results.push(result);
        }
        Ok(results)
    }

    /// Test connection by running a simple query.
    pub async fn ping(&self) -> AppResult<()> {
        self.execute("SELECT 1").await?;
        Ok(())
    }
}
