import { describe, it, expect } from "vitest";
import type { Settings, UpdateSettingsInput } from "../types";

describe("settings types", () => {
  describe("Settings", () => {
    it("should have correct camelCase fields", () => {
      const settings: Settings = {
        id: "settings-1",
        sessionId: "session-1",
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
        glow: false,
        autoScale: true,
        invert: false,
      };

      expect(settings.id).toBeDefined();
      expect(settings.sessionId).toBeDefined();
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
      expect(typeof settings.glow).toBe("boolean");
      expect(typeof settings.autoScale).toBe("boolean");
      expect(typeof settings.invert).toBe("boolean");
    });

    it("should allow undefined inputDevice", () => {
      const settings: Settings = {
        id: "settings-2",
        sessionId: "session-2",
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
        glow: true,
        autoScale: false,
        invert: true,
      };

      expect(settings.inputDevice).toBeUndefined();
      expect(settings.glow).toBe(true);
      expect(settings.autoScale).toBe(false);
      expect(settings.invert).toBe(true);
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
        triggerMode: "auto",
        triggerEdge: "falling",
      };

      expect(input.triggerLevel).toBe(0.75);
      expect(input.triggerMode).toBe("auto");
      expect(input.triggerEdge).toBe("falling");
    });

    it("should allow partial trigger updates", () => {
      const input: UpdateSettingsInput = { triggerEdge: "rising" };

      expect(input.triggerEdge).toBe("rising");
      expect(input.triggerLevel).toBeUndefined();
      expect(input.triggerMode).toBeUndefined();
    });

    it("should allow updating display effect settings", () => {
      const input: UpdateSettingsInput = {
        glow: true,
        autoScale: false,
        invert: true,
      };

      expect(input.glow).toBe(true);
      expect(input.autoScale).toBe(false);
      expect(input.invert).toBe(true);
    });
  });
});
