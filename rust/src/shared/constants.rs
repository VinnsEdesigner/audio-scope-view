#![allow(dead_code)]

pub const DEFAULT_SAMPLE_RATE: u32 = 44100;

pub const DEFAULT_BUFFER_SIZE: u32 = 1024;

pub const DEFAULT_TIME_SCALE: f64 = 1.0;

pub const DEFAULT_VOLTAGE_SCALE: f64 = 1.0;

pub const MAX_SAMPLE_RATE: u32 = 192000;

pub const MAX_BUFFER_SIZE: u32 = 16384;

pub const MIN_TIME_SCALE: f64 = 0.0001;

pub const MAX_TIME_SCALE: f64 = 10000.0;

pub const GRAPHQL_PATH: &str = "/";

pub const GRAPHQL_PLAYGROUND_PATH: &str = "/playground";

pub const HEALTH_PATH: &str = "/health";

pub const WS_PATH: &str = "/ws";

/// Maximum length accepted for a device id. UUIDs are 36 chars; the legacy
/// `dev-...` fallback is short. Anything longer is rejected as malformed.
pub const MAX_DEVICE_ID_LEN: usize = 64;

/// Validates that a device id is a well-formed, real identifier — not empty,
/// not arbitrary garbage, and within the accepted shape.
///
/// The frontend generates a UUID v4 (`crypto.randomUUID()`), with a legacy
/// `dev-<base36>-<base36>` fallback for older runtimes. Both are accepted. An
/// invalid device id must NEVER be used as a scoping key, because a malformed
/// id would either match nothing (data appears empty) or, worse, be used to
/// impersonate / enumerate another scope. Rejecting malformed ids up front
/// keeps the device-isolation dimension trustworthy.
pub fn is_valid_device_id(id: &str) -> bool {
    let trimmed = id.trim();
    if trimmed.is_empty() || trimmed.len() > MAX_DEVICE_ID_LEN {
        return false;
    }
    // Reject obvious placeholders / injection attempts.
    let lower = trimmed.to_ascii_lowercase();
    if matches!(
        lower.as_str(),
        "default" | "null" | "undefined" | "none" | "true" | "false" | "admin"
    ) {
        return false;
    }
    is_valid_uuid(trimmed) || is_valid_legacy_device_id(trimmed)
}

/// Accepts the canonical 8-4-4-4-12 hex UUID form (v1–v5 / random).
fn is_valid_uuid(s: &str) -> bool {
    let groups = [8usize, 4, 4, 4, 12];
    let mut idx = 0;
    for (i, len) in groups.iter().enumerate() {
        if i > 0 {
            // Expect a '-' separator between groups.
            if s.get(idx..idx + 1) != Some("-") {
                return false;
            }
            idx += 1;
        }
        let Some(seg) = s.get(idx..idx + len) else {
            return false;
        };
        if !seg.bytes().all(|b| b.is_ascii_hexdigit()) {
            return false;
        }
        idx += len;
    }
    idx == s.len()
}

/// Accepts the legacy frontend fallback `dev-<base36>-<base36>`.
fn is_valid_legacy_device_id(s: &str) -> bool {
    let Some(rest) = s.strip_prefix("dev-") else {
        return false;
    };
    let mut parts = rest.splitn(2, '-');
    let Some(a) = parts.next() else {
        return false;
    };
    let Some(b) = parts.next() else {
        return false;
    };
    !a.is_empty()
        && !b.is_empty()
        && a.bytes().all(|c| c.is_ascii_alphanumeric())
        && b.bytes().all(|c| c.is_ascii_alphanumeric())
}