#![allow(dead_code)]
//! GraphQL input DTOs - Request types from clients

use async_graphql::InputObject;

/// Input for creating a new scope
#[derive(InputObject)]
pub struct CreateScopeInput {
    pub name: String,
    pub description: Option<String>,
}

/// Input for updating a scope
#[derive(InputObject)]
pub struct UpdateScopeInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

/// Input for updating display settings
#[derive(InputObject)]
pub struct UpdateDisplaySettingsInput {
    pub time_scale: Option<f64>,
    pub voltage_scale: Option<f64>,
    pub time_offset: Option<f64>,
    pub voltage_offset: Option<f64>,
}

/// Input for updating trigger settings
#[derive(InputObject)]
pub struct UpdateTriggerInput {
    pub mode: Option<String>,
    pub level: Option<f64>,
    pub edge: Option<String>,
    pub channel: Option<i32>,
}

/// Input for updating scope settings
#[derive(InputObject)]
pub struct UpdateSettingsInput {
    pub scope_id: String,
    pub display: Option<UpdateDisplaySettingsInput>,
    pub trigger: Option<UpdateTriggerInput>,
}

/// Time range for filtering data
#[derive(InputObject)]
pub struct TimeRangeInput {
    pub start: Option<String>,
    pub end: Option<String>,
}
