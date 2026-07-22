/**
 * Domain types for Settings
 * These types are in camelCase (presentation format)
 */

// Domain type - camelCase presentation format
export interface Settings {
  id: string;
  scopeId: string;
  timeScale: number;
  voltageScale: number;
  timeOffset: number;
  voltageOffset: number;
  triggerLevel: number;
  triggerMode: string;
  triggerEdge: string;
  showGrid: boolean;
  showMeasurements: boolean;
  gridDivisionsX: number;
  gridDivisionsY: number;
  inputDevice: string | undefined;
  inputChannels: number;
}

export interface UpdateSettingsInput {
  timeScale?: number;
  voltageScale?: number;
  triggerLevel?: number;
  triggerMode?: string;
  triggerEdge?: string;
  showGrid?: boolean;
  showMeasurements?: boolean;
  inputDevice?: string;
}

// Server response types (snake_case)
export interface SettingsServer {
  id: string;
  scope_id: string;
  time_scale: number;
  voltage_scale: number;
  time_offset: number;
  voltage_offset: number;
  trigger_level: number;
  trigger_mode: string;
  trigger_edge: string;
  show_grid: boolean;
  show_measurements: boolean;
  grid_divisions_x: number;
  grid_divisions_y: number;
  input_device: string | undefined;
  input_channels: number;
}
