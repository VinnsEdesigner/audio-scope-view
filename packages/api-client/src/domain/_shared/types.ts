export interface PaginationParameters {
  limit?: number;
  offset?: number;
}

export interface PaginationResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export type LoadingState = "idle" | "loading" | "success" | "error";
