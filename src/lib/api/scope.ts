import { api } from "./client";

export type Calibration = {
  gain_v_per_unit: number;
  time_factor: number;
  lowpass_hz: number | null;
  smoothing: number;
};

export type Harmonic = { n: number; frequency: number; magnitude: number; db: number };

export type Measurements = {
  rms: number;
  peak_to_peak: number;
  min: number;
  max: number;
  mean: number;
  dc_offset: number;
  crest_factor: number;
  frequency: number;
  frequency_ac: number;
  period_ms: number;
  duty_cycle: number;
  thd: number;
  harmonics: Harmonic[];
  sample_rate: number;
  samples_available: number;
};

export type CalibratedReadouts = {
  vpp_v: number;
  rms_v: number;
  dc_v: number;
  frequency_hz: number;
};

export type Health = { status: string; version: string };

export const scopeApi = {
  health: () => api.get<Health>("/health").then((r) => r.data),
  getConfig: () =>
    api
      .get<{ sample_rate: number; calibration: Calibration }>("/config")
      .then((r) => r.data),
  getCalibration: () => api.get<Calibration>("/calibration").then((r) => r.data),
  setCalibration: (cal: Calibration) =>
    api.post<Calibration>("/calibration", cal).then((r) => r.data),
  measurements: () =>
    api
      .get<Measurements & { calibrated: CalibratedReadouts }>("/measurements")
      .then((r) => r.data),
  spectrum: (size = 2048) =>
    api.get<number[]>("/spectrum", { params: { size } }).then((r) => r.data),
};