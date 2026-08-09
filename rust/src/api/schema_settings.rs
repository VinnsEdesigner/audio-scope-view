
use async_graphql::{Context, Object, SimpleObject};

use crate::api::context_extractor::{GraphqlContext, device_scope_from_context};
use crate::domain::{Settings, TriggerEdge, TriggerMode};

#[derive(Debug, SimpleObject)]
pub struct SettingsOutput {
    pub id: String,
    pub session_id: String,
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
            session_id: settings.session_id,
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

#[derive(Default)]
pub struct SettingsQuery;

/// Verifies that the session `session_id` belongs to the requesting device
/// before exposing or mutating its settings. Unscoped admins (bootstrap key,
/// no device id) bypass the check. Returns `Ok(())` on access granted; an
/// error otherwise. This is the core of the device-isolation fix for settings:
/// without it, any device could read/write another device's session settings by
/// guessing the session id.
async fn assert_settings_session_owned(
    ctx: &Context<'_>,
    session_id: &str,
) -> Result<(), async_graphql::Error> {
    // Unscoped admins (no device id) may inspect any session's settings.
    let Some(ref did) = device_scope_from_context(ctx) else {
        return Ok(());
    };
    let context = ctx
        .data::<GraphqlContext>()
        .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
    let session = context
        .session_service
        .get(session_id)
        .await
        .map_err(|e| async_graphql::Error::new(format!("Failed to load session: {:?}", e)))?
        // Return "not found" rather than "forbidden" so the existence of
        // another device's session (and therefore its settings) is not leaked.
        .ok_or_else(|| async_graphql::Error::new("Session not found"))?;
    if session.user_id != *did {
        return Err(async_graphql::Error::new("Session not found"));
    }
    Ok(())
}

#[Object]
impl SettingsQuery {
    async fn settings(&self, ctx: &Context<'_>, session_id: String) -> Result<Option<SettingsOutput>, async_graphql::Error> {
        // Enforce device isolation: only the session's owning device may read
        // its settings.
        assert_settings_session_owned(ctx, &session_id).await?;

        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
        Ok(context
            .settings_service
            .get_by_session(&session_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to load settings: {:?}", e)))?
            .map(SettingsOutput::from))
    }
}

#[derive(Default)]
pub struct SettingsMutation;

#[Object]
impl SettingsMutation {
    async fn create_settings(&self, ctx: &Context<'_>, session_id: String) -> Result<Option<SettingsOutput>, async_graphql::Error> {
        // Enforce device isolation: only the owning device may create settings
        // for a session.
        assert_settings_session_owned(ctx, &session_id).await?;

        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
        let settings = context
            .settings_service
            .create_for_session(&session_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to create settings: {:?}", e)))?;
        Ok(Some(SettingsOutput::from(settings)))
    }

    #[allow(clippy::too_many_arguments)]
    async fn update_settings(
        &self,
        ctx: &Context<'_>,
        session_id: String,
        time_scale: Option<f64>,
        voltage_scale: Option<f64>,
        trigger_level: Option<f64>,
        trigger_mode: Option<String>,
        trigger_edge: Option<String>,
        show_grid: Option<bool>,
        show_measurements: Option<bool>,
        input_device: Option<String>,
    ) -> Result<Option<SettingsOutput>, async_graphql::Error> {
        // Enforce device isolation before mutating.
        assert_settings_session_owned(ctx, &session_id).await?;

        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;

        let mut settings = context
            .settings_service
            .get_by_session(&session_id)
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to load settings: {:?}", e)))?
            .ok_or_else(|| async_graphql::Error::new("Settings not found for session"))?;

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

        context
            .settings_service
            .update(settings.clone())
            .await
            .map_err(|e| async_graphql::Error::new(format!("Failed to update settings: {:?}", e)))?;
        Ok(Some(SettingsOutput::from(settings)))
    }

    async fn delete_settings(&self, ctx: &Context<'_>, session_id: String) -> Result<bool, async_graphql::Error> {
        // Enforce device isolation before deleting.
        assert_settings_session_owned(ctx, &session_id).await?;

        let context = ctx
            .data::<GraphqlContext>()
            .map_err(|e| async_graphql::Error::new(format!("Missing context: {:?}", e)))?;
        Ok(context
            .settings_service
            .delete_by_session(&session_id)
            .await
            .is_ok())
    }
}