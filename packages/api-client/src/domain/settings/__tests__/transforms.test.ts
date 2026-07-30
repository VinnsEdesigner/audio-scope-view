import { describe, it, expect } from "vitest";
import { settingsFromRaw, settingsToServerInput } from "../transforms";
import type { SettingsServer, UpdateSettingsInput } from "../types";

describe("settings transforms", () => {
  describe("settingsFromRaw", () => {
    it("should transform server SettingsServer to Settings domain type", () => {
      const serverSettings: SettingsServer = {
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

      const settings = settingsFromRaw(serverSettings);

      expect(settings.id).toBe("settings-1");
      expect(settings.sessionId).toBe("session-1");
      expect(settings.timeScale).toBe(1);
      expect(settings.voltageScale).toBe(1);
      expect(settings.triggerLevel).toBe(0);
      expect(settings.triggerMode).toBe("normal");
      expect(settings.triggerEdge).toBe("rising");
      expect(settings.showGrid).toBe(true);
      expect(settings.showMeasurements).toBe(true);
      expect(settings.gridDivisionsX).toBe(10);
      expect(settings.gridDivisionsY).toBe(8);
      expect(settings.inputDevice).toBe("Microphone");
      expect(settings.inputChannels).toBe(2);
      expect(settings.glow).toBe(false);
      expect(settings.autoScale).toBe(true);
      expect(settings.invert).toBe(false);
    });

    it("should handle undefined inputDevice", () => {
      const serverSettings: SettingsServer = {
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

      const settings = settingsFromRaw(serverSettings);

      expect(settings.inputDevice).toBeUndefined();
      expect(settings.glow).toBe(true);
      expect(settings.autoScale).toBe(false);
      expect(settings.invert).toBe(true);
    });
  });

  describe("settingsToServerInput", () => {
    it("should transform UpdateSettingsInput to server format", () => {
      const input: UpdateSettingsInput = {
        timeScale: 2,
        voltageScale: 0.5,
        showGrid: false,
        showMeasurements: true,
      };

      const serverInput = settingsToServerInput(input);

      expect(serverInput.timeScale).toBe(2);
      expect(serverInput.voltageScale).toBe(0.5);
      expect(serverInput.showGrid).toBe(false);
      expect(serverInput.showMeasurements).toBe(true);
    });

    it("should omit undefined values", () => {
      const input: UpdateSettingsInput = { showGrid: true };

      expect(input.showGrid).toBe(true);
      expect(input.timeScale).toBeUndefined();
    });

    it("should handle trigger settings", () => {
      const input: UpdateSettingsInput = {
        triggerLevel: 0.75,
        triggerMode: "auto",
        triggerEdge: "falling",
      };

      const serverInput = settingsToServerInput(input);

      expect(serverInput.triggerLevel).toBe(0.75);
      expect(serverInput.triggerMode).toBe("auto");
      expect(serverInput.triggerEdge).toBe("falling");
    });

    it("should allow partial trigger updates", () => {
      const input: UpdateSettingsInput = { triggerEdge: "rising" };

      const serverInput = settingsToServerInput(input);

      expect(serverInput.triggerEdge).toBe("rising");
      expect(serverInput.triggerLevel).toBeUndefined();
      expect(serverInput.triggerMode).toBeUndefined();
    });

    it("should handle display settings", () => {
      const input: UpdateSettingsInput = {
        glow: true,
        autoScale: false,
        invert: true,
      };

      const serverInput = settingsToServerInput(input);

      expect(serverInput.glow).toBe(true);
      expect(serverInput.autoScale).toBe(false);
      expect(serverInput.invert).toBe(true);
    });
  });
});
