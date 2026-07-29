export interface Settings {
  id: string;
  sessionId: string;
  timeScale: number;
  voltageScale: number;
  timeOffset: number;
  voltageOffset: number;
  triggerLevel: number;
  triggerMode: "normal" | "auto";
  triggerEdge: "rising" | "falling" | "auto";
  showGrid: boolean;
  showMeasurements: boolean;
  gridDivisionsX: number;
  gridDivisionsY: number;
  inputDevice: string | undefined;
  inputChannels: number;
  glow: boolean;
  autoScale: boolean;
  invert: boolean;
}

export interface UpdateSettingsInput {
  timeScale?: number;
  voltageScale?: number;
  triggerLevel?: number;
  triggerMode?: "normal" | "auto";
  triggerEdge?: "rising" | "falling" | "auto";
  showGrid?: boolean;
  showMeasurements?: boolean;
  inputDevice?: string;
  glow?: boolean;
  autoScale?: boolean;
  invert?: boolean;
}

export interface SettingsServer {
  id: string;
  session_id: string;
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
  glow: boolean;
  auto_scale: boolean;
  invert: boolean;
}
