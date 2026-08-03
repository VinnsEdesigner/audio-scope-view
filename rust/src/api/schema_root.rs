//! Root GraphQL schema - Combines all sub-schemas

use async_graphql::{MergedObject, Schema};

use super::{
    schema_audio_input::{AudioInputMutationRoot, AudioInputQueryRoot},
    schema_dashboard::DashboardQuery,
    schema_dsp::{DspMutationRoot, DspQueryRoot},
    schema_export::{
        ApiKeyMutationRoot, ApiKeyQueryRoot,
        BatchCaptureMutationRoot, 
        ExportQueryRoot, SimulationMutationRoot, SimulationQueryRoot
    },
    schema_recording::{RecordingMutation, RecordingQuery},
    schema_session::{SessionMutation, SessionQuery},
    schema_settings::{SettingsMutation, SettingsQuery},
    schema_subscription::SubscriptionRoot,
    schema_user_preferences::{UserPreferencesMutation, UserPreferencesQuery},
    schema_waveform::{WaveformMutation, WaveformQuery},
};

/// Combined query type
#[derive(MergedObject, Default)]
pub struct Query(
    SessionQuery, 
    SettingsQuery, 
    DashboardQuery, 
    WaveformQuery, 
    RecordingQuery,
    ExportQueryRoot, 
    SimulationQueryRoot,
    ApiKeyQueryRoot,
    AudioInputQueryRoot,
    DspQueryRoot,
    UserPreferencesQuery,
);

/// Combined mutation type
#[derive(MergedObject, Default)]
pub struct Mutation(
    SessionMutation, 
    SettingsMutation, 
    WaveformMutation, 
    RecordingMutation,
    BatchCaptureMutationRoot, 
    SimulationMutationRoot,
    ApiKeyMutationRoot,
    AudioInputMutationRoot,
    DspMutationRoot,
    UserPreferencesMutation,
);

/// Root subscription type (using SubscriptionRoot for real-time streaming)
pub type Subscription = SubscriptionRoot;

/// Build the GraphQL schema
pub fn build_schema() -> Schema<Query, Mutation, Subscription> {
    Schema::build(Query::default(), Mutation::default(), SubscriptionRoot)
        .finish()
}
