import { describe, it, expect } from "vitest";
import type { Settings, UpdateSettingsInput } from "../types";

describe("settings types", () => {
  describe("Settings", () => {
    it("should have correct camelCase fields", () => {
      const settings: Settings = {
        id: "settings-1",
        scopeId: "scope-1",
        timeScale: 1,
        voltageScale: 1,
        timeOffset: 0,
        voltageOffset: 0,
        triggerLevel: 0,
        triggerMode: "normal",
        triggerEdge: "rising",
        showGrid: true,
        showMeasurements: true,
        gridDivisionsX: 10,
        gridDivisionsY: 8,
        inputDevice: "Microphone",
        inputChannels: 2,
      };

      expect(settings.id).toBeDefined();
      expect(settings.scopeId).toBeDefined();
      expect(typeof settings.timeScale).toBe("number");
      expect(typeof settings.voltageScale).toBe("number");
      expect(typeof settings.timeOffset).toBe("number");
      expect(typeof settings.voltageOffset).toBe("number");
      expect(typeof settings.triggerLevel).toBe("number");
      expect(typeof settings.triggerMode).toBe("string");
      expect(typeof settings.triggerEdge).toBe("string");
      expect(typeof settings.showGrid).toBe("boolean");
      expect(typeof settings.showMeasurements).toBe("boolean");
      expect(typeof settings.gridDivisionsX).toBe("number");
      expect(typeof settings.gridDivisionsY).toBe("number");
    });

    it("should allow undefined inputDevice", () => {
      const settings: Settings = {
        id: "settings-2",
        scopeId: "scope-2",
        timeScale: 0.5,
        voltageScale: 0.5,
        timeOffset: 0.1,
        voltageOffset: -0.1,
        triggerLevel: 0.5,
        triggerMode: "auto",
        triggerEdge: "falling",
        showGrid: false,
        showMeasurements: false,
        gridDivisionsX: 12,
        gridDivisionsY: 10,
        inputDevice: undefined,
        inputChannels: 1,
      };

      expect(settings.inputDevice).toBeUndefined();
    });
  });

  describe("UpdateSettingsInput", () => {
    it("should allow updating display settings", () => {
      const input: UpdateSettingsInput = {
        timeScale: 2,
        voltageScale: 0.5,
        showGrid: false,
        showMeasurements: true,
      };

      expect(input.timeScale).toBe(2);
      expect(input.voltageScale).toBe(0.5);
      expect(input.showGrid).toBe(false);
      expect(input.showMeasurements).toBe(true);
    });

    it("should allow partial updates", () => {
      const input: UpdateSettingsInput = { showGrid: true };

      expect(input.showGrid).toBe(true);
      expect(input.timeScale).toBeUndefined();
    });

    it("should allow updating trigger settings", () => {
      const input: UpdateSettingsInput = {
        triggerLevel: 0.75,
        triggerMode: "single",
        triggerEdge: "both",
      };

      expect(input.triggerLevel).toBe(0.75);
      expect(input.triggerMode).toBe("single");
      expect(input.triggerEdge).toBe("both");
    });

    it("should allow partial trigger updates", () => {
      const input: UpdateSettingsInput = { triggerEdge: "falling" };

      expect(input.triggerEdge).toBe("falling");
      expect(input.triggerLevel).toBeUndefined();
      expect(input.triggerMode).toBeUndefined();
    });
  });
});
