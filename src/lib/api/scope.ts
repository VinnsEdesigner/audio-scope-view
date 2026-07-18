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

// The DSP engine is stateless server-side: calibration is sent per request
// via the `x-scope-cal` header (see `openScopeStream`). No REST needed for
// config or measurements — the /process response already carries both.