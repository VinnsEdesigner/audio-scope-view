# Audio Scope View - Rust Server Architecture

## Overview

A clean, layered Rust server architecture with hexagonal/ports-and-adapters design principles. The architecture separates concerns into distinct layers, ensuring testability, maintainability, and scalability.

---

## Directory Structure

```
rust/
├── Cargo.toml                              # Project manifest & dependencies
├── Cargo.lock                              # Locked dependency versions
├── .env                                    # Environment variables (gitignored)
├── .env.example                            # Example environment template
│
├── src/
│   ├── main.rs                             # Application entry point
│   ├── lib.rs                              # Library root for testing
│   │
│   ├── api/                                # ═══════════════════════════════════
│   │   ├── mod.rs                          # Module root & re-exports
│   │   ├── server_graphql.rs               # GraphQL server setup (Axum + async-graphql)
│   │   ├── schema_root.rs                  # Root GraphQL schema
│   │   ├── schema_scope.rs                 # Scope GraphQL schema
│   │   ├── schema_settings.rs              # Settings GraphQL schema
│   │   ├── schema_subscription.rs          # GraphQL subscriptions (waveform stream)
│   │   ├── resolver_scope.rs               # Scope resolver implementation
│   │   ├── resolver_settings.rs            # Settings resolver implementation
│   │   ├── resolver_dashboard.rs           # Dashboard data resolver
│   │   ├── context_extractor.rs            # GraphQL context extractor
│   │   ├── dto_graphql_in.rs               # GraphQL input DTOs
│   │   ├── dto_graphql_out.rs              # GraphQL output DTOs (for complex types)
│   │   └── middleware_cors.rs               # CORS middleware (for GraphQL playground)
│   │
│   ├── application/                        # ═══════════════════════════════════
│   │   ├── mod.rs                          # Module root & re-exports
│   │   ├── service_scope.rs                # Scope business logic
│   │   ├── service_settings.rs             # Settings business logic
│   │   ├── service_audio.rs                # Audio processing orchestration
│   │   ├── service_dashboard.rs            # Dashboard data aggregation
│   │   └── mapper_scope.rs                 # Entity <-> DTO mappers
│   │
│   ├── domain/                             # ═══════════════════════════════════
│   │   ├── mod.rs                          # Module root & re-exports
│   │   ├── entity_scope.rs                 # Scope entity
│   │   ├── entity_settings.rs              # Settings entity
│   │   ├── entity_capture.rs               # Audio capture entity
│   │   ├── entity_waveform.rs              # Waveform data entity
│   │   ├── entity_dashboard_summary.rs     # Dashboard aggregated data entity
│   │   ├── trait_scope_repository.rs       # Scope repository trait
│   │   ├── trait_settings_repository.rs    # Settings repository trait
│   │   ├── trait_audio_capture.rs          # Audio capture trait
│   │   ├── error_domain.rs                 # Domain-specific errors
│   │   ├── valueobject_frequency.rs       # Frequency value object
│   │   ├── valueobject_amplitude.rs        # Amplitude value object
│   │   ├── valueobject_timescale.rs        # Time scale value object
│   │   └── valueobject_timerange.rs        # Time range value object
│   │
│   ├── infrastructure/                     # ═══════════════════════════════════
│   │   ├── mod.rs                          # Module root & re-exports
│   │   ├── database_connection.rs          # SQLite connection pool
│   │   ├── database_migrations.rs          # Migration runner
│   │   ├── repo_sqlite_scope.rs            # SQLite scope implementation
│   │   ├── repo_sqlite_settings.rs         # SQLite settings implementation
│   │   ├── audio_capture_alsa.rs           # ALSA audio capture impl
│   │   ├── audio_capture_pulse.rs           # PulseAudio capture impl
│   │   ├── audio_capture_mock.rs            # Mock capture for testing
│   │   └── config_loader.rs                 # Configuration loader
│   │
│   └── shared/                             # ═══════════════════════════════════
│       ├── mod.rs                          # Module root & re-exports
│       ├── error_app.rs                    # Application-wide errors
│       ├── error_graphql.rs                # GraphQL-specific errors
│       ├── result_type.rs                  # Result type aliases
│       ├── config_struct.rs                 # Configuration struct
│       ├── constants.rs                    # Application constants
│       ├── utils_time.rs                   # Time utilities
│       └── utils_serialization.rs          # Serialization helpers
│
├── migrations/                             # SQL migration files
│   ├── 001_create_scopes.sql
│   ├── 002_create_settings.sql
│   └── 003_create_waveforms.sql
│
└── tests/
    ├── unit_domain/
    │   ├── test_entity_scope.rs
    │   ├── test_entity_settings.rs
    │   └── test_valueobjects.rs
    ├── unit_application/
    │   ├── test_service_scope.rs
    │   ├── test_service_dashboard.rs
    │   └── test_service_settings.rs
    ├── integration_graphql/
    │   ├── test_schema_scope.rs
    │   ├── test_schema_dashboard.rs
    │   └── test_resolver_scope.rs
    └── helpers/
        ├── mod.rs
        ├── mock_scope_repo.rs
        └── test_database.rs
```

---

## Layer Dependencies

```
┌─────────────────────────────────────────────────────────┐
│                      API LAYER                          │
│   (handlers, routes, middleware, dtos, extractors)    │
│                          ↓                               │
│                    Calls via traits                     │
├─────────────────────────────────────────────────────────┤
│                  APPLICATION LAYER                      │
│           (services, mappers, use cases)               │
│                          ↓                               │
│                    Uses entities                        │
├─────────────────────────────────────────────────────────┤
│                    DOMAIN LAYER                          │
│        (entities, traits, errors, value objects)       │
│                          ↑                               │
│              Defined by, not dependent on              │
├─────────────────────────────────────────────────────────┤
│                INFRASTRUCTURE LAYER                     │
│    (repositories impl, database, audio capture impl)   │
│         Implements domain traits at runtime            │
├─────────────────────────────────────────────────────────┤
│                   SHARED LAYER                          │
│              (errors, config, utils)                    │
└─────────────────────────────────────────────────────────┘
```

---

## Key Principles

### 1. Dependency Inversion
Domain traits define interfaces; infrastructure implements them at runtime.

### 2. No Cross-Layer Imports
- `application` can use `domain`
- `infrastructure` can use `domain`
- `api` can use `application` and `domain`
- `shared` has no dependencies on other layers

### 3. Unique Filenames
Each file has a unique, descriptive name following the pattern:
- `handler_{entity}.rs` - HTTP handlers
- `dto_{entity}_{direction}.rs` - DTOs (in/out)
- `service_{feature}.rs` - Application services
- `entity_{name}.rs` - Domain entities
- `trait_{name}_repository.rs` - Repository traits
- `repo_{db}_{entity}.rs` - Repository implementations
- `valueobject_{name}.rs` - Value objects
- `routes_{feature}.rs` - Route definitions
- `middleware_{name}.rs` - Middleware
- `error_{layer}.rs` - Error types

---

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| GraphQL Server | `server_graphql.rs` | `server_graphql.rs` |
| Schema | `schema_{feature}.rs` | `schema_scope.rs` |
| Resolver | `resolver_{feature}.rs` | `resolver_dashboard.rs` |
| GraphQL Input DTO | `dto_graphql_in.rs` | `dto_graphql_in.rs` (consolidated) |
| GraphQL Output DTO | `dto_graphql_out.rs` | `dto_graphql_out.rs` (consolidated) |
| Context | `context_extractor.rs` | `context_extractor.rs` |
| Service | `service_{feature}.rs` | `service_dashboard.rs` |
| Entity | `entity_{name}.rs` | `entity_dashboard_summary.rs` |
| Trait | `trait_{name}_repository.rs` | `trait_scope_repository.rs` |
| Repository Impl | `repo_{db}_{entity}.rs` | `repo_sqlite_scope.rs` |
| Value Object | `valueobject_{name}.rs` | `valueobject_frequency.rs` |
| Error | `error_{layer}.rs` | `error_graphql.rs` |
| Utility | `utils_{name}.rs` | `utils_time.rs` |

---

## Next Steps

1. Add dependencies to `Cargo.toml`
2. Create migration files in `migrations/`
3. Implement domain layer first (entities, traits, errors, value objects)
4. Implement infrastructure layer (SQLite repositories, audio capture)
5. Implement application layer (services, dashboard aggregation)
6. Implement API layer (GraphQL schemas, resolvers, directives)
7. Wire everything in `main.rs` with `server_graphql.rs`
8. Add GraphQL subscriptions for real-time waveform streaming

---

## Recommended Crates

```toml
# Web framework
axum = { version = "0.7", features = ["ws"] }  # WebSocket support for subscriptions
tower = "0.4"
tower-http = { version = "0.5", features = ["cors", "trace"] }

# GraphQL
async-graphql = "7"
async-graphql-axum = "7"

# Async runtime
tokio = { version = "1", features = ["full"] }

# Database
sqlx = { version = "0.7", features = ["sqlite", "runtime-tokio", "migrate", "chrono"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Error handling
thiserror = "1"
anyhow = "1"

# Configuration
config = "0.14"

# Logging
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

# Date/Time
chrono = { version = "0.4", features = ["serde"] }

# Validation
validator = { version = "0.16", features = ["derive"] }

# UUID
uuid = { version = "1", features = ["v4", "serde"] }
```

---

## GraphQL API Design

### Example Schema (dashboard query)

```graphql
type Query {
  # Dashboard aggregates
  dashboardSummary(timeRange: TimeRange!): DashboardSummary!
  
  # Scope queries
  scopes(limit: Int, offset: Int): [Scope!]!
  scope(id: ID!): Scope
  
  # Settings
  settings: Settings!
}

type Mutation {
  # Scope operations
  createScope(input: CreateScopeInput!): Scope!
  updateScope(id: ID!, input: UpdateScopeInput!): Scope!
  deleteScope(id: ID!): Boolean!
  
  # Settings
  updateSettings(input: UpdateSettingsInput!): Settings!
}

type Subscription {
  # Real-time waveform stream
  waveformStream(scopeId: ID!): WaveformData!
}
```

### Key GraphQL Features Used

| Feature | Purpose |
|---------|---------|
| Queries | Read dashboard data, scopes, settings |
| Mutations | Create/update/delete scopes, update settings |
| Subscriptions | Real-time waveform data streaming |
| Context | Inject DB pool, repos into resolvers |
| Batch Queries | Efficient data loading with DataLoader pattern |
