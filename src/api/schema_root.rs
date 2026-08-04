
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

pub type Subscription = SubscriptionRoot;

pub fn build_schema() -> Schema<Query, Mutation, Subscription> {
    Schema::build(Query::default(), Mutation::default(), SubscriptionRoot)
        .finish()
}