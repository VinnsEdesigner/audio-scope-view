import { describe, it, expect } from "vitest";
import { settingsFromRaw, settingsToServerInput } from "../transforms";
import type { SettingsServer, UpdateSettingsInput } from "../types";

describe("settings transforms", () => {
  describe("settingsFromRaw", () => {
    it("should transform server SettingsServer to Settings domain type", () => {
      const serverSettings: SettingsServer = {
        id: "settings-1",
        scope_id: "scope-1",
        time_scale: 1,
        voltage_scale: 1,
        time_offset: 0,
        voltage_offset: 0,
        trigger_level: 0,
        trigger_mode: "normal",
        trigger_edge: "rising",
        show_grid: true,
        show_measurements: true,
        grid_divisions_x: 10,
        grid_divisions_y: 8,
        input_device: "Microphone",
        input_channels: 2,
      };

      const settings = settingsFromRaw(serverSettings);

      expect(settings.id).toBe("settings-1");
      expect(settings.scopeId).toBe("scope-1");
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
    });

    it("should handle undefined input_device", () => {
      const serverSettings: SettingsServer = {
        id: "settings-2",
        scope_id: "scope-2",
        time_scale: 0.5,
        voltage_scale: 0.5,
        time_offset: 0.1,
        voltage_offset: -0.1,
        trigger_level: 0.5,
        trigger_mode: "auto",
        trigger_edge: "falling",
        show_grid: false,
        show_measurements: false,
        grid_divisions_x: 12,
        grid_divisions_y: 10,
        input_device: undefined,
        input_channels: 1,
      };

      const settings = settingsFromRaw(serverSettings);

      expect(settings.inputDevice).toBeUndefined();
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
        triggerMode: "single",
        triggerEdge: "both",
      };

      const serverInput = settingsToServerInput(input);

      expect(serverInput.triggerLevel).toBe(0.75);
      expect(serverInput.triggerMode).toBe("single");
      expect(serverInput.triggerEdge).toBe("both");
    });

    it("should allow partial trigger updates", () => {
      const input: UpdateSettingsInput = { triggerEdge: "falling" };

      const serverInput = settingsToServerInput(input);

      expect(serverInput.triggerEdge).toBe("falling");
      expect(serverInput.triggerLevel).toBeUndefined();
      expect(serverInput.triggerMode).toBeUndefined();
    });
  });
});
