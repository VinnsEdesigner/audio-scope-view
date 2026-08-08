//! Turso HTTP Client for database operations
//! Uses the Turso HTTP API v2 to execute SQL queries

use serde::{Deserialize, Serialize};
use crate::shared::error_app::{AppError, AppResult};

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
    Error(TursoError),
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

    /// Execute a SQL statement and return the results
    pub async fn execute(&self, sql: &str) -> AppResult<TursoResponse> {
        let request = PipelineRequest {
            request_type: "execute".to_string(),
            stmt: StmtRequest {
                sql: sql.to_string(),
            },
        };

        let response = self.client
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
                "Turso query failed with status {}: {}", status, body
            )));
        }

        let body = response.text().await.map_err(|e| AppError::database(&format!("Failed to read response body: {}", e)))?;
        
        // Debug: print the response body
        eprintln!("Turso response: {}", body);
        
        let result: TursoResponse = serde_json::from_str(&body)
            .map_err(|e| AppError::database(&format!("Failed to parse Turso response: {} - body: {}", e, body)))?;

        // Check for SQL-level errors
        if let Some(TursoResult::Error(err)) = result.results.first() {
            return Err(AppError::database(&format!("Turso SQL error: {}", err.message)));
        }

        Ok(result)
    }

    /// Execute a SQL statement without returning results (for INSERT/UPDATE/DELETE)
    pub async fn execute_void(&self, sql: &str) -> AppResult<()> {
        let result = self.execute(sql).await?;
        
        // Check if there are results and if they indicate success
        if let Some(TursoResult::Ok(ok_result)) = result.results.first() {
            if ok_result.response.result.rows_written > 0 || ok_result.response.result.rows_read > 0 {
                return Ok(());
            }
        }
        
        Ok(())
    }

    /// Execute multiple SQL statements
    pub async fn execute_batch(&self, statements: &[&str]) -> AppResult<Vec<TursoResponse>> {
        let mut results = Vec::new();
        for sql in statements {
            let result = self.execute(sql).await?;
            results.push(result);
        }
        Ok(results)
    }

    /// Test connection by running a simple query
    pub async fn ping(&self) -> AppResult<()> {
        self.execute("SELECT 1").await?;
        Ok(())
    }
}
