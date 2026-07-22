//! Domain pagination utilities

/// Offset-based pagination parameters
#[derive(Debug, Clone, Default)]
pub struct OffsetPagination {
    pub limit: u32,
    pub offset: u32,
}

impl OffsetPagination {
    pub fn new(limit: u32, offset: u32) -> Self {
        Self { limit, offset }
    }

    pub fn with_defaults(limit: Option<u32>, offset: Option<u32>) -> Self {
        Self {
            limit: limit.unwrap_or(20).min(100),
            offset: offset.unwrap_or(0),
        }
    }

    pub fn has_more(&self, total: u32) -> bool {
        self.offset.saturating_add(self.limit) < total
    }
}

/// Cursor-based pagination parameters
#[derive(Debug, Clone)]
pub struct CursorPagination {
    pub limit: u32,
    pub cursor: Option<String>,
}

impl CursorPagination {
    pub fn new(limit: u32, cursor: Option<String>) -> Self {
        Self { limit, cursor }
    }

    pub fn with_defaults(limit: Option<u32>, cursor: Option<String>) -> Self {
        Self {
            limit: limit.unwrap_or(20).min(100),
            cursor,
        }
    }
}

/// Generic pagination parameters
#[derive(Debug, Clone)]
pub struct PaginationParams {
    pub limit: u32,
    pub offset: u32,
    pub cursor: Option<String>,
    pub use_cursor: bool,
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            limit: 20,
            offset: 0,
            cursor: None,
            use_cursor: false,
        }
    }
}

impl PaginationParams {
    pub fn offset_based(limit: u32, offset: u32) -> Self {
        Self {
            limit,
            offset,
            cursor: None,
            use_cursor: false,
        }
    }

    pub fn cursor_based(limit: u32, cursor: Option<String>) -> Self {
        Self {
            limit,
            offset: 0,
            cursor,
            use_cursor: true,
        }
    }

    pub fn first(limit: u32) -> Self {
        Self::offset_based(limit, 0)
    }

    pub fn after(cursor: String, limit: u32) -> Self {
        Self::cursor_based(limit, Some(cursor))
    }
}

/// Page metadata for responses
#[derive(Debug, Clone)]
pub struct PageMeta {
    pub total: u32,
    pub limit: u32,
    pub offset: u32,
    pub has_next: bool,
    pub has_previous: bool,
}

impl PageMeta {
    pub fn new(total: u32, limit: u32, offset: u32) -> Self {
        Self {
            total,
            limit,
            offset,
            has_next: offset.saturating_add(limit) < total,
            has_previous: offset > 0,
        }
    }
}
