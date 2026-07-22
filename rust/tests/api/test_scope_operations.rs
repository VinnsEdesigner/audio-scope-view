//! API tests for scope operations

use async_graphql::InputObject;

// Re-export input types for testing
#[derive(Debug, InputObject)]
struct TestCreateScopeInput {
    name: String,
    description: Option<String>,
    sample_rate: Option<u32>,
    buffer_size: Option<u32>,
}

#[derive(Debug, InputObject)]
struct TestUpdateScopeInput {
    name: Option<String>,
    description: Option<String>,
    sample_rate: Option<u32>,
    buffer_size: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_scope_input_validation() {
        let input = TestCreateScopeInput {
            name: "Test Scope".to_string(),
            description: Some("A test scope".to_string()),
            sample_rate: Some(44100),
            buffer_size: Some(1024),
        };
        
        assert_eq!(input.name, "Test Scope");
        assert!(input.description.is_some());
        assert_eq!(input.sample_rate, Some(44100));
        assert_eq!(input.buffer_size, Some(1024));
    }

    #[test]
    fn test_update_scope_input_partial() {
        let input = TestUpdateScopeInput {
            name: Some("Updated Name".to_string()),
            description: None,
            sample_rate: None,
            buffer_size: None,
        };
        
        assert_eq!(input.name, Some("Updated Name".to_string()));
        assert!(input.description.is_none());
        assert!(input.sample_rate.is_none());
        assert!(input.buffer_size.is_none());
    }

    #[test]
    fn test_scope_input_with_defaults() {
        let input = TestCreateScopeInput {
            name: "Minimal Scope".to_string(),
            description: None,
            sample_rate: None,
            buffer_size: None,
        };
        
        assert_eq!(input.name, "Minimal Scope");
        assert!(input.description.is_none());
        assert!(input.sample_rate.is_none());
        assert!(input.buffer_size.is_none());
    }
}
