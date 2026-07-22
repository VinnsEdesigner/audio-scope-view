//! Settings GraphQL schema

use async_graphql::{Context, Object, SimpleObject};

use crate::api::context_extractor::GraphqlContext;
use crate::domain::{Settings, TriggerEdge, TriggerMode};

/// Settings output type
#[derive(Debug, SimpleObject)]
pub struct SettingsOutput {
    pub id: String,
    pub scope_id: String,
    pub time_scale: f64,
    pub voltage_scale: f64,
    pub time_offset: f64,
    pub voltage_offset: f64,
    pub trigger_level: f64,
    pub trigger_mode: String,
    pub trigger_edge: String,
    pub show_grid: bool,
    pub show_measurements: bool,
    pub grid_divisions_x: u32,
    pub grid_divisions_y: u32,
    pub input_device: Option<String>,
    pub input_channels: u32,
}

impl From<Settings> for SettingsOutput {
    fn from(settings: Settings) -> Self {
        Self {
            id: settings.id,
            scope_id: settings.scope_id,
            time_scale: settings.time_scale,
            voltage_scale: settings.voltage_scale,
            time_offset: settings.time_offset,
            voltage_offset: settings.voltage_offset,
            trigger_level: settings.trigger_level,
            trigger_mode: settings.trigger_mode.as_str().to_string(),
            trigger_edge: settings.trigger_edge.as_str().to_string(),
            show_grid: settings.show_grid,
            show_measurements: settings.show_measurements,
            grid_divisions_x: settings.grid_divisions_x,
            grid_divisions_y: settings.grid_divisions_y,
            input_device: settings.input_device,
            input_channels: settings.input_channels,
        }
    }
}

/// Settings query operations
#[derive(Default)]
pub struct SettingsQuery;

#[Object]
impl SettingsQuery {
    /// Get settings by scope ID
    async fn settings(&self, ctx: &Context<'_>, scope_id: String) -> Option<SettingsOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .settings_service
            .get_by_scope(&scope_id)
            .await
            .ok()
            .flatten()
            .map(SettingsOutput::from)
    }
}

/// Settings mutation operations
#[derive(Default)]
pub struct SettingsMutation;

#[Object]
impl SettingsMutation {
    /// Create default settings for a scope
    async fn create_settings(&self, ctx: &Context<'_>, scope_id: String) -> Option<SettingsOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .settings_service
            .create_for_scope(&scope_id)
            .await
            .ok()
            .map(SettingsOutput::from)
    }

    /// Update settings
    #[allow(clippy::too_many_arguments)]
    async fn update_settings(
        &self,
        ctx: &Context<'_>,
        scope_id: String,
        time_scale: Option<f64>,
        voltage_scale: Option<f64>,
        trigger_level: Option<f64>,
        trigger_mode: Option<String>,
        trigger_edge: Option<String>,
        show_grid: Option<bool>,
        show_measurements: Option<bool>,
        input_device: Option<String>,
    ) -> Option<SettingsOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        // Get or create settings
        let mut settings = context
            .settings_service
            .get_by_scope(&scope_id)
            .await
            .ok()
            .flatten()?;

        // Update fields
        if let Some(ts) = time_scale {
            settings = settings.with_time_scale(ts);
        }
        if let Some(vs) = voltage_scale {
            settings = settings.with_voltage_scale(vs);
        }
        if let Some(tl) = trigger_level {
            settings = settings.with_trigger_level(tl);
        }
        if let Some(tm) = trigger_mode {
            settings.trigger_mode = TriggerMode::from_str(&tm).unwrap_or(settings.trigger_mode);
            settings.updated_at = chrono::Utc::now();
        }
        if let Some(te) = trigger_edge {
            settings.trigger_edge = TriggerEdge::from_str(&te).unwrap_or(settings.trigger_edge);
            settings.updated_at = chrono::Utc::now();
        }
        if let Some(sg) = show_grid {
            settings.show_grid = sg;
            settings.updated_at = chrono::Utc::now();
        }
        if let Some(sm) = show_measurements {
            settings.show_measurements = sm;
            settings.updated_at = chrono::Utc::now();
        }
        if let Some(id) = input_device {
            settings = settings.with_input_device(Some(id));
        }

        // Save and return
        context
            .settings_service
            .update(settings.clone())
            .await
            .ok()?;
        Some(SettingsOutput::from(settings))
    }

    /// Delete settings for a scope
    async fn delete_settings(&self, ctx: &Context<'_>, scope_id: String) -> bool {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        context
            .settings_service
            .delete_by_scope(&scope_id)
            .await
            .is_ok()
    }
}
