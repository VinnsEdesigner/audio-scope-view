#![allow(dead_code)]
//! Scope resolver - Business logic for scope operations

use crate::domain::Scope;

/// Scope resolver trait
pub trait ScopeResolver: Send + Sync {
    fn resolve_id<'a>(&self, scope: &'a Scope) -> &'a str {
        &scope.id
    }
    fn resolve_name<'a>(&self, scope: &'a Scope) -> &'a str {
        &scope.name
    }
    fn resolve_is_active(&self, scope: &Scope) -> bool {
        scope.is_active
    }
}
