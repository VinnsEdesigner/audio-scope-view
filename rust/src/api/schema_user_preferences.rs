
use async_graphql::{Context, Object, SimpleObject};

use crate::api::context_extractor::GraphqlContext;

#[derive(Debug, SimpleObject)]
pub struct UserPreferencesOutput {
    pub id: String,
    #[graphql(name = "lastUsedSessionId")]
    pub last_used_session_id: Option<String>,
    #[graphql(name = "autoSelectLastSession")]
    pub auto_select_last_session: bool,
    #[graphql(name = "autoCloseTimeoutSecs")]
    pub auto_close_timeout_secs: Option<i32>,
}

#[derive(Default)]
pub struct UserPreferencesQuery;

#[Object]
impl UserPreferencesQuery {
    async fn user_preferences(&self, ctx: &Context<'_>) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let prefs_id = "default-user";

        let prefs = context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
            .ok()?;

        Some(UserPreferencesOutput {
            id: prefs.id,
            last_used_session_id: prefs.last_used_session_id,
            auto_select_last_session: prefs.auto_select_last_session,
            auto_close_timeout_secs: prefs.auto_close_timeout_secs,
        })
    }

    async fn last_used_session(&self, ctx: &Context<'_>) -> Option<String> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let prefs_id = "default-user";

        let prefs = context
            .user_preferences_repository
            .get(prefs_id)
            .await
            .ok()
            .flatten()?;

        prefs.last_used_session_id
    }
}

#[derive(Default)]
pub struct UserPreferencesMutation;

#[Object]
impl UserPreferencesMutation {
    async fn set_last_used_session(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let prefs_id = "default-user";

        let mut prefs = match context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
        {
            Ok(p) => p,
            Err(_) => return None,
        };

        prefs.update_last_used_session(Some(session_id));

        if context
            .user_preferences_repository
            .save(&prefs)
            .await
            .is_err()
        {
            return None;
        }

        Some(UserPreferencesOutput {
            id: prefs.id,
            last_used_session_id: prefs.last_used_session_id,
            auto_select_last_session: prefs.auto_select_last_session,
            auto_close_timeout_secs: prefs.auto_close_timeout_secs,
        })
    }

    async fn set_auto_select_last_session(
        &self,
        ctx: &Context<'_>,
        auto_select: bool,
    ) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let prefs_id = "default-user";

        let mut prefs = match context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
        {
            Ok(p) => p,
            Err(_) => return None,
        };

        prefs.update_auto_select(auto_select);

        if context
            .user_preferences_repository
            .save(&prefs)
            .await
            .is_err()
        {
            return None;
        }

        Some(UserPreferencesOutput {
            id: prefs.id,
            last_used_session_id: prefs.last_used_session_id,
            auto_select_last_session: prefs.auto_select_last_session,
            auto_close_timeout_secs: prefs.auto_close_timeout_secs,
        })
    }

    async fn set_auto_close_timeout(
        &self,
        ctx: &Context<'_>,
        timeout_secs: Option<i32>,
    ) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let prefs_id = "default-user";

        let mut prefs = match context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
        {
            Ok(p) => p,
            Err(_) => return None,
        };

        prefs.update_auto_close_timeout(timeout_secs);

        if context
            .user_preferences_repository
            .save(&prefs)
            .await
            .is_err()
        {
            return None;
        }

        Some(UserPreferencesOutput {
            id: prefs.id,
            last_used_session_id: prefs.last_used_session_id,
            auto_select_last_session: prefs.auto_select_last_session,
            auto_close_timeout_secs: prefs.auto_close_timeout_secs,
        })
    }

    async fn update_user_preferences(
        &self,
        ctx: &Context<'_>,
        last_used_session_id: Option<String>,
        auto_select_last_session: Option<bool>,
        auto_close_timeout_secs: Option<i32>,
    ) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");

        let prefs_id = "default-user";

        let mut prefs = match context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
        {
            Ok(p) => p,
            Err(_) => return None,
        };

        if let Some(session_id) = last_used_session_id {
            prefs.update_last_used_session(Some(session_id));
        }
        if let Some(auto_select) = auto_select_last_session {
            prefs.update_auto_select(auto_select);
        }
        if let Some(timeout_secs) = auto_close_timeout_secs {
            prefs.update_auto_close_timeout(Some(timeout_secs));
        }

        if context
            .user_preferences_repository
            .save(&prefs)
            .await
            .is_err()
        {
            return None;
        }

        Some(UserPreferencesOutput {
            id: prefs.id,
            last_used_session_id: prefs.last_used_session_id,
            auto_select_last_session: prefs.auto_select_last_session,
            auto_close_timeout_secs: prefs.auto_close_timeout_secs,
        })
    }
}