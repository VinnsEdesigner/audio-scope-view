#![allow(dead_code)]

use async_graphql::InputObject;

#[derive(InputObject)]
pub struct CreateScopeInput {
    pub name: String,
    pub description: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateScopeInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(InputObject)]
pub struct UpdateDisplaySettingsInput {
    pub time_scale: Option<f64>,
    pub voltage_scale: Option<f64>,
    pub time_offset: Option<f64>,
    pub voltage_offset: Option<f64>,
}

#[derive(InputObject)]
pub struct UpdateTriggerInput {
    pub mode: Option<String>,
    pub level: Option<f64>,
    pub edge: Option<String>,
    pub channel: Option<i32>,
}

#[derive(InputObject)]
pub struct UpdateSettingsInput {
    pub scope_id: String,
    pub display: Option<UpdateDisplaySettingsInput>,
    pub trigger: Option<UpdateTriggerInput>,
}

#[derive(InputObject)]
pub struct TimeRangeInput {
    pub start: Option<String>,
    pub end: Option<String>,
}
