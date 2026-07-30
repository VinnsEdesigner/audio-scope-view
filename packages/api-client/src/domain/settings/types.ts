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
  sessionId: string;
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
  glow: boolean;
  autoScale: boolean;
  invert: boolean;
}
