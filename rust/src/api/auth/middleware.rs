#![allow(dead_code)]

use std::sync::Arc;

use axum::{
    extract::Request,
    middleware::Next,
    response::{IntoResponse, Response},
};

use super::api_key::ApiKeyStore;

pub async fn auth_middleware(
    req: Request,
    next: Next,
    key_store: Arc<ApiKeyStore>,
) -> Response {
    let auth_header = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok());

    let api_key = match auth_header {
        Some(header) => {
            let key = if let Some(stripped) = header.strip_prefix("Bearer ") {
                stripped
            } else {
                header
            };
            key_store.validate(key).await
        }
        None => None,
    };

    if let Some(key) = api_key {
        if !key_store.check_rate_limit(&key.key, key.rate_limit_per_minute).await {
            return (
                axum::http::StatusCode::TOO_MANY_REQUESTS,
                "Rate limit exceeded",
            )
                .into_response();
        }

        let mut request = req;
        request.extensions_mut().insert(key);
        next.run(request).await
    } else {
        (
            axum::http::StatusCode::UNAUTHORIZED,
            "Invalid or missing API key",
        )
            .into_response()
    }
}

pub fn extract_api_key(req: &Request) -> Option<String> {
    req.headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .map(|header| {
            if let Some(stripped) = header.strip_prefix("Bearer ") {
                stripped.to_string()
            } else {
                header.to_string()
            }
        })
}
