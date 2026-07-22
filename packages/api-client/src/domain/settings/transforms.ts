import type { Settings, SettingsServer, UpdateSettingsInput } from "./types";

/**
 * Transform server response (snake_case) to domain type (camelCase)
 */
export function settingsFromRaw(serverSettings: SettingsServer): Settings {
  return {
    id: serverSettings.id,
    scopeId: serverSettings.scope_id,
    timeScale: serverSettings.time_scale,
    voltageScale: serverSettings.voltage_scale,
    timeOffset: serverSettings.time_offset,
    voltageOffset: serverSettings.voltage_offset,
    triggerLevel: serverSettings.trigger_level,
    triggerMode: serverSettings.trigger_mode as "auto" | "normal",
    triggerEdge: serverSettings.trigger_edge as "rising" | "falling" | "auto",
    showGrid: serverSettings.show_grid,
    showMeasurements: serverSettings.show_measurements,
    gridDivisionsX: serverSettings.grid_divisions_x,
    gridDivisionsY: serverSettings.grid_divisions_y,
    inputDevice: serverSettings.input_device,
    inputChannels: serverSettings.input_channels,
  };
}

/**
 * Transform UI input to server format (camelCase → snake_case)
 */
export function settingsToServerInput(input: UpdateSettingsInput): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (input.timeScale !== undefined) result.timeScale = input.timeScale;
  if (input.voltageScale !== undefined) result.voltageScale = input.voltageScale;
  if (input.triggerLevel !== undefined) result.triggerLevel = input.triggerLevel;
  if (input.triggerMode !== undefined) result.triggerMode = input.triggerMode;
  if (input.triggerEdge !== undefined) result.triggerEdge = input.triggerEdge;
  if (input.showGrid !== undefined) result.showGrid = input.showGrid;
  if (input.showMeasurements !== undefined) result.showMeasurements = input.showMeasurements;
  if (input.inputDevice !== undefined) result.inputDevice = input.inputDevice;

  return result;
}
