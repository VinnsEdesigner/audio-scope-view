import { describe, it, expect } from "vitest";
import type { PaginationParameters, PaginationResult, ApiError, LoadingState } from "../types";

describe("shared types", () => {
	describe("PaginationParameters", () => {
		it("should have optional limit and offset", () => {
			const params: PaginationParameters = {
				limit: 10,
			};

			expect(params.limit).toBe(10);
			expect(params.offset).toBeUndefined();
		});

		it("should allow offset for pagination", () => {
			const params: PaginationParameters = {
				limit: 20,
				offset: 40,
			};

			expect(params.limit).toBe(20);
			expect(params.offset).toBe(40);
		});
	});

	describe("PaginationResult", () => {
		it("should have items, total, and hasMore", () => {
			const result: PaginationResult<string> = {
				items: ["a", "b", "c"],
				total: 100,
				hasMore: true,
			};

			expect(result.items).toHaveLength(3);
			expect(result.total).toBe(100);
			expect(result.hasMore).toBe(true);
		});

		it("should allow hasMore false", () => {
			const result: PaginationResult<number> = {
				items: [1, 2, 3],
				total: 3,
				hasMore: false,
			};

			expect(result.hasMore).toBe(false);
		});
	});

	describe("ApiError", () => {
		it("should have message and optional code", () => {
			const error: ApiError = {
				message: "Something went wrong",
			};

			expect(error.message).toBe("Something went wrong");
			expect(error.code).toBeUndefined();
		});

		it("should allow code for specific error types", () => {
			const error: ApiError = {
				message: "Not found",
				code: "NOT_FOUND",
			};

			expect(error.code).toBe("NOT_FOUND");
		});

		it("should allow details for additional error info", () => {
			const error: ApiError = {
				message: "Validation failed",
				code: "VALIDATION_ERROR",
				details: { field: "email", issue: "invalid format" },
			};

			expect(error.details).toEqual({ field: "email", issue: "invalid format" });
		});
	});

	describe("LoadingState", () => {
		it("should allow 'idle' state", () => {
			const state: LoadingState = "idle";

			expect(state).toBe("idle");
		});

		it("should allow 'loading' state", () => {
			const state: LoadingState = "loading";

			expect(state).toBe("loading");
		});

		it("should allow 'success' state", () => {
			const state: LoadingState = "success";

			expect(state).toBe("success");
		});

		it("should allow 'error' state", () => {
			const state: LoadingState = "error";

			expect(state).toBe("error");
		});
	});
});
