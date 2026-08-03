//! User Preferences GraphQL schema

use async_graphql::{Context, Object, SimpleObject};

use crate::api::context_extractor::GraphqlContext;

/// User Preferences output type
#[derive(Debug, SimpleObject)]
pub struct UserPreferencesOutput {
    pub id: String,
    #[graphql(name = "lastUsedSessionId")]
    pub last_used_session_id: Option<String>,
    #[graphql(name = "autoSelectLastSession")]
    pub auto_select_last_session: bool,
}

/// User Preferences query operations
#[derive(Default)]
pub struct UserPreferencesQuery;

#[Object]
impl UserPreferencesQuery {
    /// Get user preferences by ID (or create default if not exists)
    async fn user_preferences(&self, ctx: &Context<'_>) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        
        // Use a default user ID for now (can be extended for multi-user)
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
        })
    }

    /// Get the last used session
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

/// User Preferences mutation operations
#[derive(Default)]
pub struct UserPreferencesMutation;

#[Object]
impl UserPreferencesMutation {
    /// Update the last used session ID
    async fn set_last_used_session(
        &self,
        ctx: &Context<'_>,
        session_id: String,
    ) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        
        let prefs_id = "default-user";
        
        // Get or create preferences
        let mut prefs = match context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
        {
            Ok(p) => p,
            Err(_) => return None,
        };
        
        // Update the last used session
        prefs.update_last_used_session(Some(session_id));
        
        // Save
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
        })
    }

    /// Set auto-select last session preference
    async fn set_auto_select_last_session(
        &self,
        ctx: &Context<'_>,
        auto_select: bool,
    ) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        
        let prefs_id = "default-user";
        
        // Get or create preferences
        let mut prefs = match context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
        {
            Ok(p) => p,
            Err(_) => return None,
        };
        
        // Update auto-select setting
        prefs.update_auto_select(auto_select);
        
        // Save
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
        })
    }

    /// Update both last used session and auto-select at once
    async fn update_user_preferences(
        &self,
        ctx: &Context<'_>,
        last_used_session_id: Option<String>,
        auto_select_last_session: Option<bool>,
    ) -> Option<UserPreferencesOutput> {
        let context = ctx
            .data::<GraphqlContext>()
            .expect("Missing GraphqlContext");
        
        let prefs_id = "default-user";
        
        // Get or create preferences
        let mut prefs = match context
            .user_preferences_repository
            .get_or_create(prefs_id)
            .await
        {
            Ok(p) => p,
            Err(_) => return None,
        };
        
        // Update fields if provided
        if let Some(session_id) = last_used_session_id {
            prefs.update_last_used_session(Some(session_id));
        }
        if let Some(auto_select) = auto_select_last_session {
            prefs.update_auto_select(auto_select);
        }
        
        // Save
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
        })
    }
}
