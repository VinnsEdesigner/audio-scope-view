import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { useAudioAnalyzer } from "@/hooks";
import {
  calculatePeak,
  calculateRMS,
  calculateDCOffset,
  calculateFrequency,
} from "@audio-scope-view/api-client/domain/_shared/audio-utilities";

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

export function MeasurementsDialog({ isOpen, onClose }: MeasurementsDialogProperties) {
  const { samples, sampleRate, isCapturing } = useAudioAnalyzer();

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

    const vpp = calculatePeak(samples) * 2; // Peak-to-peak is 2x peak
    const rms = calculateRMS(samples);
    const dcOffset = calculateDCOffset(samples);
    const frequency = calculateFrequency(samples, sampleRate);

    setMeasurements({
      vpp,
      rms,
      dcOffset,
      frequency,
      sampleRate,
    });
  }, [samples, sampleRate, isCapturing]);

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Measurements" maxWidth="max-w-sm">
      <div className="space-y-4">
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
    </Dialog>
  );
}
