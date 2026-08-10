import * as React from "react";
import { X, Activity, Zap, Volume2, Mic, Gauge, Waves, BarChart3, Cpu } from "lucide-react";
import type { AnalysisUpdate, HarmonicComponent } from "@/hooks";

interface CalibrationDialogProperties {
  isOpen: boolean;
  onClose: () => void;

  analysisData: AnalysisUpdate | undefined;

  isCapturing: boolean;
}

interface MetricRowProperties {
  label: string;
  value: string;
  unit?: string;
  icon: React.ReactNode;
  status?: "good" | "warning" | "bad" | "neutral";
  description?: string;
}

function MetricRow({
  label,
  value,
  unit,
  icon,
  status = "neutral",
  description,
}: MetricRowProperties) {
  // All statuses use gray for a cleaner, monochrome look
  const statusColors = {
    good: "text-gray-400",
    warning: "text-gray-400",
    bad: "text-gray-400",
    neutral: "text-foreground",
  };

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-bg-elevated rounded-lg">
      <div className="w-8 h-8 flex items-center justify-center rounded-md bg-bg-tertiary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-tertiary uppercase tracking-wide">{label}</div>
        {description && (
          <div className="text-[10px] text-text-tertiary/70 mt-0.5">{description}</div>
        )}
      </div>
      <div className={`text-right font-mono font-semibold ${statusColors[status]}`}>
        {value}
        {unit && <span className="text-xs text-text-secondary ml-1">{unit}</span>}
      </div>
    </div>
  );
}

interface HarmonicBarProperties {
  harmonic: HarmonicComponent;
}

function HarmonicBar({ harmonic }: HarmonicBarProperties) {
  const magnitudePercent = Math.min(harmonic.magnitude * 100, 100);
  const isFundamental = harmonic.harmonic === 1;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-text-tertiary w-6 text-right">
        H{harmonic.harmonic}
      </span>
      <div className="flex-1 h-4 bg-bg-tertiary rounded overflow-hidden">
        <div
          className={`h-full rounded transition-all ${isFundamental ? "bg-green-500" : "bg-cyan-500"}`}
          style={{ width: `${magnitudePercent}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-secondary w-16 text-right">
        {harmonic.frequency > 0 ? `${harmonic.frequency.toFixed(1)}Hz` : "—"}
      </span>
    </div>
  );
}

function formatDecibel(database: number): string {
  if (!Number.isFinite(database) || database < -100) return "—";
  return database.toFixed(1);
}

function formatPercent(ratio: number): string {
  const percent = ratio * 100;
  if (!Number.isFinite(percent)) return "—";
  return percent.toFixed(3);
}

function formatFrequency(freq: number): string {
  if (!Number.isFinite(freq) || freq <= 0) return "—";
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(3)}k`;
  }
  return freq.toFixed(2);
}

function formatAmplitude(amp: number): string {
  if (!Number.isFinite(amp) || amp < 0) return "—";
  return amp.toFixed(4);
}

function formatEnergy(energy: number): string {
  if (!Number.isFinite(energy) || energy < 0) return "—";

  if (energy > 1e6) return energy.toExponential(2);
  if (energy > 1000) return (energy / 1000).toFixed(2) + "k";
  return energy.toFixed(4);
}

function getThdStatus(thd: number): "good" | "warning" | "bad" {
  if (thd < 0.01) return "good";
  if (thd < 0.05) return "warning";
  return "bad";
}

function getThdnStatus(thdn: number): "good" | "warning" | "bad" {
  if (thdn < 0.02) return "good";
  if (thdn < 0.1) return "warning";
  return "bad";
}

function getSnrStatus(snr: number): "good" | "warning" | "bad" {
  if (snr > 60) return "good";
  if (snr > 40) return "warning";
  return "bad";
}

function getCrestFactorStatus(cf: number): "good" | "warning" | "bad" {
  if (cf < 2) return "good";
  if (cf < 5) return "warning";
  return "bad";
}

function getDcOffsetStatus(dc: number): "good" | "warning" | "bad" {
  const dcMv = Math.abs(dc) * 1000;
  if (dcMv < 1) return "good";
  if (dcMv < 10) return "warning";
  return "bad";
}

export function CalibrationDialog({
  isOpen,
  onClose,
  analysisData,
  isCapturing,
}: CalibrationDialogProperties) {
  // eslint-disable-next-line unicorn/no-null -- React idiom: components return null when not rendering
  if (!isOpen) return null;

  const hasData = analysisData !== undefined;
  // Show LIVE badge when capturing; metrics always come from the server.
  const isLive = isCapturing;

  const peakAmplitude = analysisData?.peakAmplitude ?? 0;
  const rmsAmplitude = analysisData?.rmsAmplitude ?? 0;
  const dcOffset = analysisData?.dcOffset ?? 0;
  const dominantFrequency = analysisData?.dominantFrequency ?? 0;
  const fundamentalFrequency = analysisData?.fundamentalFrequency ?? 0;
  const thd = analysisData?.thd ?? 0;
  const thdn = analysisData?.thdn ?? 0;
  const snr = analysisData?.snr ?? 0;
  const crestFactor = analysisData?.crestFactor ?? 0;
  const signalEnergy = analysisData?.signalEnergy ?? 0;
  const noiseEnergy = analysisData?.noiseEnergy ?? 0;
  const harmonics = analysisData?.harmonics ?? [];

  return (
    <div className="w-[420px] max-h-[80vh] overflow-y-auto">
      {}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle sticky top-0 bg-bg-primary z-10">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground tracking-tight">Calibration</h2>
          {isLive && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full text-[10px] font-medium">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-hover transition-all"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
      </div>

      {}
      <div className="p-4 space-y-5">
        {hasData ? (
          <>
            {}
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <Mic size={12} />
                Frequency Analysis
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <MetricRow
                  label="Dominant"
                  value={formatFrequency(dominantFrequency)}
                  unit="Hz"
                  icon={<Activity size={14} className="text-gray-400" />}
                  description="Peak frequency"
                />
                <MetricRow
                  label="Fundamental"
                  value={formatFrequency(fundamentalFrequency)}
                  unit="Hz"
                  icon={<Waves size={14} className="text-gray-400" />}
                  description="1st harmonic"
                />
              </div>
            </div>

            {}
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <BarChart3 size={12} />
                Amplitude
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <MetricRow
                  label="Peak"
                  value={formatAmplitude(peakAmplitude)}
                  icon={<Activity size={14} className="text-gray-400" />}
                  description="Maximum"
                />
                <MetricRow
                  label="RMS"
                  value={formatAmplitude(rmsAmplitude)}
                  icon={<Activity size={14} className="text-gray-400" />}
                  description="Root mean square"
                />
                <MetricRow
                  label="DC Offset"
                  value={(dcOffset * 1000).toFixed(3)}
                  unit="mV"
                  icon={<Activity size={14} className="text-gray-400" />}
                  status={getDcOffsetStatus(dcOffset)}
                  description="Average offset"
                />
                <MetricRow
                  label="Crest Factor"
                  value={formatAmplitude(crestFactor)}
                  icon={<Gauge size={14} className="text-gray-400" />}
                  status={getCrestFactorStatus(crestFactor)}
                  description="Peak / RMS"
                />
              </div>
            </div>

            {}
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <Cpu size={12} />
                Signal Quality
              </h3>
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <MetricRow
                    label="THD"
                    value={formatPercent(thd)}
                    unit="%"
                    icon={<Zap size={14} className="text-gray-400" />}
                    status={getThdStatus(thd)}
                    description="Harmonic distortion"
                  />
                  <MetricRow
                    label="THD+N"
                    value={formatPercent(thdn)}
                    unit="%"
                    icon={<Zap size={14} className="text-gray-400" />}
                    status={getThdnStatus(thdn)}
                    description="With noise"
                  />
                  <MetricRow
                    label="SNR"
                    value={formatDecibel(snr)}
                    unit="dB"
                    icon={<Volume2 size={14} className="text-gray-400" />}
                    status={getSnrStatus(snr)}
                    description="Signal-to-noise"
                  />
                </div>
              </div>
            </div>

            {}
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <BarChart3 size={12} />
                Energy Analysis
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <MetricRow
                  label="Signal Energy"
                  value={formatEnergy(signalEnergy)}
                  icon={<Activity size={14} className="text-gray-400" />}
                  description="Fundamental + harmonics"
                />
                <MetricRow
                  label="Noise Energy"
                  value={formatEnergy(noiseEnergy)}
                  icon={<Activity size={14} className="text-gray-400" />}
                  description="Non-harmonic"
                />
              </div>
            </div>

            {}
            <div>
              <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wide mb-3 flex items-center gap-2">
                <Waves size={12} />
                Harmonic Breakdown
              </h3>
              <div className="space-y-1.5 bg-bg-elevated rounded-lg p-3">
                {harmonics.length === 0 ? (
                  <p className="text-xs text-text-tertiary text-center py-2">
                    No harmonic data available
                  </p>
                ) : (
                  <>
                    {}
                    <div className="flex items-center gap-2 mb-2 text-[10px] text-text-tertiary uppercase">
                      <span className="w-6 text-right">#</span>
                      <div className="flex-1">Magnitude</div>
                      <span className="w-16 text-right">Frequency</span>
                    </div>
                    {}
                    {harmonics.map((h) => (
                      <HarmonicBar key={h.harmonic} harmonic={h} />
                    ))}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto mb-4 text-text-tertiary opacity-30" />
            {isCapturing ? (
              <>
                <p className="text-sm text-text-secondary">Waiting for analysis data...</p>
                <p className="text-xs text-text-tertiary mt-2">
                  Analysis data should appear shortly
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-text-secondary">
                  Start a capture to view server-calculated DSP metrics
                </p>
                <p className="text-xs text-text-tertiary mt-2">
                  Press Probe to begin analyzing audio
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {}
      <div className="px-4 py-3 border-t border-border-subtle bg-bg-tertiary/50 sticky bottom-0">
        <p className="text-[10px] text-text-tertiary text-center">
          All metrics computed server-side via FFT and harmonic analysis
        </p>
      </div>
    </div>
  );
}
