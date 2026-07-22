import { describe, it, expect } from "vitest";
import { scopeFromRaw, scopesFromRaw, scopeToServerInput } from "../transforms";
import type { ScopeServer, CreateScopeInput, UpdateScopeInput } from "../types";

describe("scope transforms", () => {
	describe("scopeFromRaw", () => {
		it("should transform server ScopeServer to Scope domain type", () => {
			const serverScope: ScopeServer = {
				id: "scope-1",
				name: "Test Scope",
				description: "A test scope",
				is_active: true,
				sample_rate: 44100,
				buffer_size: 4096,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
			};

			const scope = scopeFromRaw(serverScope);

			expect(scope.id).toBe("scope-1");
			expect(scope.name).toBe("Test Scope");
			expect(scope.description).toBe("A test scope");
			expect(scope.isActive).toBe(true);
			expect(scope.sampleRate).toBe(44100);
			expect(scope.bufferSize).toBe(4096);
			expect(scope.createdAt).toBeInstanceOf(Date);
			expect(scope.updatedAt).toBeInstanceOf(Date);
		});

		it("should handle null description", () => {
			const serverScope: ScopeServer = {
				id: "scope-2",
				name: "No Description",
				description: null,
				is_active: false,
				sample_rate: 48000,
				buffer_size: 8192,
				created_at: "2024-01-15T10:30:00Z",
				updated_at: "2024-01-15T10:30:00Z",
			};

			const scope = scopeFromRaw(serverScope);

			expect(scope.description).toBeNull();
			expect(scope.isActive).toBe(false);
		});

		it("should correctly parse ISO date strings", () => {
			const serverScope: ScopeServer = {
				id: "scope-3",
				name: "Date Test",
				description: null,
				is_active: true,
				sample_rate: 96000,
				buffer_size: 512,
				created_at: "2024-03-10T12:00:00.000Z",
				updated_at: "2024-03-10T12:00:00.000Z",
			};

			const scope = scopeFromRaw(serverScope);

			expect(scope.createdAt.getTime()).toBe(new Date("2024-03-10T12:00:00.000Z").getTime());
			expect(scope.updatedAt.getTime()).toBe(new Date("2024-03-10T12:00:00.000Z").getTime());
		});
	});

	describe("scopesFromRaw", () => {
		it("should transform array of server scopes", () => {
			const serverScopes: ScopeServer[] = [
				{
					id: "scope-1",
					name: "Scope 1",
					description: null,
					is_active: true,
					sample_rate: 44100,
					buffer_size: 4096,
					created_at: "2024-01-01T00:00:00Z",
					updated_at: "2024-01-01T00:00:00Z",
				},
				{
					id: "scope-2",
					name: "Scope 2",
					description: "Second scope",
					is_active: false,
					sample_rate: 48000,
					buffer_size: 8192,
					created_at: "2024-01-02T00:00:00Z",
					updated_at: "2024-01-02T00:00:00Z",
				},
			];

			const scopes = scopesFromRaw(serverScopes);

			expect(scopes).toHaveLength(2);
			expect(scopes[0].id).toBe("scope-1");
			expect(scopes[1].id).toBe("scope-2");
			expect(scopes[0].isActive).toBe(true);
			expect(scopes[1].isActive).toBe(false);
		});
	});

	describe("scopeToServerInput", () => {
		it("should transform CreateScopeInput to server format", () => {
			const input: CreateScopeInput = {
				name: "New Scope",
				description: "Created via UI",
				sampleRate: 44100,
				bufferSize: 4096,
			};

			const serverInput = scopeToServerInput(input);

			expect(serverInput.name).toBe("New Scope");
			expect(serverInput.description).toBe("Created via UI");
			expect(serverInput.sampleRate).toBe(44100);
			expect(serverInput.bufferSize).toBe(4096);
		});

		it("should omit undefined values", () => {
			const input: UpdateScopeInput = { name: "Partial Update" };

			const serverInput = scopeToServerInput(input);

			expect(serverInput.name).toBe("Partial Update");
			expect("description" in serverInput).toBe(false);
			expect("sampleRate" in serverInput).toBe(false);
		});

		it("should handle isActive in UpdateScopeInput", () => {
			const input: UpdateScopeInput = { isActive: false };

			const serverInput = scopeToServerInput(input);

			expect(serverInput.isActive).toBe(false);
		});
	});
});
