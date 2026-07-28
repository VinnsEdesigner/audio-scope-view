import { describe, it, expect } from "vitest";
import type { Scope, CreateScopeInput, UpdateScopeInput, CaptureSettingsInput } from "../types";

describe("scope types", () => {
  describe("Scope", () => {
    it("should have correct camelCase fields", () => {
      const scope: Scope = {
        id: "scope-1",
        name: "Test Scope",
        description: "A test scope",
        isActive: true,
        sampleRate: 44_100,
        bufferSize: 4096,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      expect(typeof scope.id).toBe("string");
      expect(typeof scope.name).toBe("string");
      expect(typeof scope.isActive).toBe("boolean");
      expect(typeof scope.sampleRate).toBe("number");
      expect(typeof scope.bufferSize).toBe("number");
      expect(scope.createdAt).toBeInstanceOf(Date);
    });

    it("should allow undefined description", () => {
      const scope: Scope = {
        id: "scope-2",
        name: "No Description",
        description: undefined,
        isActive: false,
        sampleRate: 48_000,
        bufferSize: 8192,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(scope.description).toBeUndefined();
    });
  });

  describe("CreateScopeInput", () => {
    it("should require name field", () => {
      const input: CreateScopeInput = { name: "New Scope" };

      expect(input.name).toBe("New Scope");
    });

    it("should allow optional fields", () => {
      const input: CreateScopeInput = {
        name: "Full Scope",
        description: "With options",
        sampleRate: 44_100,
        bufferSize: 4096,
      };

      expect(input.description).toBe("With options");
      expect(input.sampleRate).toBe(44_100);
      expect(input.bufferSize).toBe(4096);
    });
  });

  describe("UpdateScopeInput", () => {
    it("should allow partial updates", () => {
      const input: UpdateScopeInput = { isActive: false };

      expect(input.isActive).toBe(false);
      expect(input.name).toBeUndefined();
    });

    it("should allow updating multiple fields", () => {
      const input: UpdateScopeInput = {
        name: "Updated Name",
        isActive: true,
        sampleRate: 96_000,
      };

      expect(input.name).toBe("Updated Name");
      expect(input.isActive).toBe(true);
      expect(input.sampleRate).toBe(96_000);
    });
  });

  describe("CaptureSettingsInput", () => {
    it("should have camelCase fields", () => {
      const input: CaptureSettingsInput = {
        frequency: 1000,
        amplitude: 0.5,
        noiseLevel: 0.02,
        durationMs: 100,
      };

      expect(input.frequency).toBe(1000);
      expect(input.amplitude).toBe(0.5);
      expect(input.noiseLevel).toBe(0.02);
      expect(input.durationMs).toBe(100);
    });

    it("should allow partial input", () => {
      const input: CaptureSettingsInput = { noiseLevel: 0.01 };

      expect(input.noiseLevel).toBe(0.01);
      expect(input.frequency).toBeUndefined();
    });
  });
});
