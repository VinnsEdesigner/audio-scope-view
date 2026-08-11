import * as React from "react";
import { X } from "lucide-react";
import { useAudioAnalyzer } from "@/hooks";
import { getDsp } from "@/lib/dsp-loader";

interface MeasurementsDialogProperties {
  isOpen: boolean;
  onClose: () => void;
}

interface MeasurementCardProperties {
  value: string;
  label: string;
  unit?: string;
}

function MeasurementCard({ value, label, unit }: MeasurementCardProperties) {
  return (
    <div className="bg-bg-elevated rounded-lg p-4">
      <div className="text-lg font-semibold font-mono text-foreground">
        {value}
        {unit && <span className="text-sm text-text-secondary ml-1">{unit}</span>}
      </div>
      <div className="text-xs text-text-tertiary uppercase tracking-wide mt-1">{label}</div>
    </div>
  );
}

function formatFrequency(freq: number): string {
  if (freq === 0) return "0.00";
  if (freq >= 1000) {
    return freq.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }
  return freq.toFixed(2);
}

function formatPeriod(freq: number): string {
  if (freq === 0) return "—";
  return (1000 / freq).toFixed(3);
}

export function MeasurementsDialog({ isOpen: _isOpen, onClose }: MeasurementsDialogProperties) {
  const { analysisFrame, sampleRate, isCapturing } = useAudioAnalyzer();
  const samples = analysisFrame;

  const [measurements, setMeasurements] = React.useState({
    vpp: 0,
    rms: 0,
    dcOffset: 0,
    frequency: 0,
    sampleRate: 0,
  });

  React.useEffect(() => {
    if (!isCapturing || samples.length === 0) {
      setMeasurements({
        vpp: 0,
        rms: 0,
        dcOffset: 0,
        frequency: 0,
        sampleRate: sampleRate || 0,
      });
      return;
    }

    const dsp = getDsp();
    const vpp = (dsp ? dsp.findPeakAmplitude(samples) : 0) * 2;
    const rms = dsp ? dsp.computeRms(samples) : 0;
    const dcOffset = dsp ? dsp.computeDcOffset(samples) : 0;
    const frequency = dsp ? dsp.estimateDominantFrequency(samples, sampleRate) : 0;

    setMeasurements({
      vpp,
      rms,
      dcOffset,
      frequency,
      sampleRate,
    });
  }, [samples, sampleRate, isCapturing]);

  return (
    <div className="w-[320px]">
      {}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
        <h2 className="text-base font-semibold text-foreground tracking-tight">Measurements</h2>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-md text-text-secondary hover:text-foreground hover:bg-bg-hover transition-all"
          aria-label="Close dialog"
        >
          <X size={16} />
        </button>
      </div>

      {}
      <div className="p-4 space-y-4">
        <p className="text-xs text-text-tertiary leading-relaxed">
          Live readouts from the DSP engine. Values follow calibration and update several times per
          second.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <MeasurementCard value={measurements.vpp.toFixed(4)} label="Vpp (V)" />
          <MeasurementCard value={measurements.rms.toFixed(4)} label="RMS (V)" />
          <MeasurementCard
            value={(measurements.dcOffset * 1000).toFixed(2)}
            label="DC offset (mV)"
          />
          <MeasurementCard value={formatFrequency(measurements.frequency)} label="Frequency (Hz)" />
          <MeasurementCard value={formatPeriod(measurements.frequency)} label="Period (ms)" />
          <MeasurementCard
            value={measurements.sampleRate > 0 ? measurements.sampleRate.toLocaleString() : "—"}
            label="Sample rate (Hz)"
          />
        </div>
      </div>
    </div>
  );
}
