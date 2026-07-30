import type { Settings, SettingsServer, UpdateSettingsInput } from "./types";

export function settingsFromRaw(serverSettings: SettingsServer): Settings {
  return {
    id: serverSettings.id,
    sessionId: serverSettings.sessionId,
    timeScale: serverSettings.timeScale,
    voltageScale: serverSettings.voltageScale,
    timeOffset: serverSettings.timeOffset,
    voltageOffset: serverSettings.voltageOffset,
    triggerLevel: serverSettings.triggerLevel,
    triggerMode: serverSettings.triggerMode as "auto" | "normal",
    triggerEdge: serverSettings.triggerEdge as "rising" | "falling" | "auto",
    showGrid: serverSettings.showGrid,
    showMeasurements: serverSettings.showMeasurements,
    gridDivisionsX: serverSettings.gridDivisionsX,
    gridDivisionsY: serverSettings.gridDivisionsY,
    inputDevice: serverSettings.inputDevice,
    inputChannels: serverSettings.inputChannels,
    glow: serverSettings.glow,
    autoScale: serverSettings.autoScale,
    invert: serverSettings.invert,
  };
}

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
  if (input.glow !== undefined) result.glow = input.glow;
  if (input.autoScale !== undefined) result.autoScale = input.autoScale;
  if (input.invert !== undefined) result.invert = input.invert;

  return result;
}
