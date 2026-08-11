// waveform-generator-dialog.tsx — flexible C++ waveform generator settings dialog.
//
// Replaces the single "Test Mode" toggle with a full generator panel: pick the
// waveform kind (sine/square/sawtooth/triangle/noise), set frequency, amplitude,
// and (for noise) the noise color. The dialog drives the `useWaveformGenerator`
// hook's setters. When closed, the generator stops feeding the scope (the
// analyzer swap in scope-page returns to the real audio analyzer).

import * as React from "react";
import { X } from "lucide-react";
import type { GeneratorKind, NoiseType } from "@audio-scope-view/dsp-wasm";
import type { WaveformGeneratorSettings, UseWaveformGeneratorReturn } from "@/hooks/use-waveform-generator";

interface WaveformGeneratorDialogProperties {
  open: boolean;
  onClose: () => void;
  generator: UseWaveformGeneratorReturn;
}

const KIND_OPTIONS: { value: GeneratorKind; label: string }[] = [
  { value: "sine", label: "Sine" },
  { value: "square", label: "Square" },
  { value: "sawtooth", label: "Sawtooth" },
  { value: "triangle", label: "Triangle" },
  { value: "noise", label: "Noise" },
];

const NOISE_OPTIONS: { value: NoiseType; label: string }[] = [
  { value: "white", label: "White" },
  { value: "pink", label: "Pink" },
  { value: "brown", label: "Brown" },
];

const PRESET_FREQUENCIES = [100, 440, 1000, 5000];

export function WaveformGeneratorDialog({
  open,
  onClose,
  generator,
}: WaveformGeneratorDialogProperties) {
  if (!open) return null;
  const { settings, setKind, setFrequency, setAmplitude, setNoiseType } = generator;
  const isNoise = settings.kind === "noise";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[420px] max-w-[90vw] rounded-lg border border-border-subtle bg-bg-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Waveform Generator</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-text-secondary hover:bg-bg-base hover:text-foreground"
            aria-label="Close generator dialog"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4">
          {/* Waveform kind */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-text-secondary">Waveform</label>
            <div className="grid grid-cols-5 gap-1.5">
              {KIND_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setKind(opt.value)}
                  className={`py-2 rounded-md text-[12px] font-medium transition-colors ${
                    settings.kind === opt.value
                      ? "bg-foreground text-bg-base"
                      : "bg-bg-base text-foreground/80 hover:bg-bg-subtle"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Frequency (hidden for noise) */}
          {!isNoise && (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[12px]">
                <label className="text-text-secondary">Frequency</label>
                <span className="font-mono text-foreground">
                  {settings.frequency >= 1000
                    ? `${(settings.frequency / 1000).toFixed(2)} kHz`
                    : `${settings.frequency.toFixed(0)} Hz`}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={20000}
                step={1}
                value={settings.frequency}
                onChange={(e) => setFrequency(Number(e.target.value))}
                className="w-full accent-foreground"
              />
              <div className="flex gap-1.5">
                {PRESET_FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className="flex-1 py-1 rounded-md text-[11px] bg-bg-base text-text-secondary hover:bg-bg-subtle"
                  >
                    {f >= 1000 ? `${f / 1000}k` : f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Noise color (only for noise) */}
          {isNoise && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[12px] text-text-secondary">Noise color</label>
              <div className="grid grid-cols-3 gap-1.5">
                {NOISE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNoiseType(opt.value)}
                    className={`py-2 rounded-md text-[12px] font-medium transition-colors ${
                      settings.noiseType === opt.value
                        ? "bg-foreground text-bg-base"
                        : "bg-bg-base text-foreground/80 hover:bg-bg-subtle"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Amplitude */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[12px]">
              <label className="text-text-secondary">Amplitude</label>
              <span className="font-mono text-foreground">
                {settings.amplitude.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={settings.amplitude}
              onChange={(e) => setAmplitude(Number(e.target.value))}
              className="w-full accent-foreground"
            />
          </div>

          {generator.error && (
            <div className="rounded-md bg-red-500/10 px-3 py-2 text-[12px] text-red-400">
              {generator.error.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
