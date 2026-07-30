import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Mic,
  MonitorCheck,
  Eye,
  Info,
  ChevronDown,
} from "lucide-react";
import { useUIStore, useMediaDevices, useAudioSettings } from "@/hooks";
import { useToast } from "@/hooks";
import type { WaveformColor } from "@/store/ui-store";
import { APP_VERSION } from "@audio-scope-view/api-client";
import { cn } from "@/lib/utilities";

const WAVEFORM_COLORS: { value: WaveformColor; color: string }[] = [
  { value: "cyan", color: "#06b6d4" },
  { value: "blue", color: "#3b82f6" },
  { value: "purple", color: "#8b5cf6" },
  { value: "green", color: "#22c55e" },
  { value: "orange", color: "#f97316" },
  { value: "red", color: "#ef4444" },
];

function getPermissionStatus(permissionState: string): { text: string; className: string } {
  switch (permissionState) {
    case "granted": {
      return { text: "Microphone access granted", className: "bg-success" };
    }
    case "denied": {
      return { text: "Microphone access denied", className: "bg-destructive" };
    }
    default: {
      return { text: "Microphone access permission required", className: "bg-warning" };
    }
  }
}

interface SectionProperties {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ icon, title, description, children }: SectionProperties) {
  return (
    <section className="mb-10 animate-[fadeInUp_0.4s_ease_forwards]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 flex items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
          {icon}
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-foreground tracking-tight">{title}</h2>
          <p className="text-sm text-text-tertiary">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

interface SettingsCardProperties {
  children: React.ReactNode;
}

function SettingsCard({ children }: SettingsCardProperties) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-secondary overflow-hidden">
      {children}
    </div>
  );
}

interface SettingsRowProperties {
  label: string;
  description?: string;
  children: React.ReactNode;
  border?: boolean;
}

function SettingsRow({ label, description, children, border = true }: SettingsRowProperties) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 py-5 transition-colors hover:bg-bg-hover",
        border && "border-b border-border-subtle",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground mb-0.5">{label}</div>
        {description && (
          <div className="text-xs text-text-tertiary leading-relaxed">{description}</div>
        )}
      </div>
      <div className="ml-6 flex-shrink-0">{children}</div>
    </div>
  );
}

export function Settings(): React.ReactElement {
  const {
    theme,
    setTheme,
    showGrid,
    setShowGrid,
    showMeasurements,
    setShowMeasurements,
    smoothWaveform,
    setSmoothWaveform,
    waveformColor,
    setWaveformColor,
  } = useUIStore();

  const { devices, selectedDeviceId, setSelectedDeviceId, permissionState } = useMediaDevices();
  const { sampleRate, bufferSize, setSampleRate, setBufferSize } = useAudioSettings();
  const { addToast } = useToast();
  const permission = getPermissionStatus(permissionState);

  const sampleRateOptions = [
    { value: 44_100, label: "44.1 kHz" },
    { value: 48_000, label: "48 kHz" },
    { value: 96_000, label: "96 kHz" },
  ];

  const bufferSizeOptions = [
    { value: 256, label: "256 samples" },
    { value: 512, label: "512 samples" },
    { value: 1024, label: "1024 samples" },
  ];

  return (
    <div className="w-full min-h-screen">
      {}
      <div className="w-full px-6 py-6 sm:px-8 md:px-10 lg:px-14 xl:px-20">
        {}
        <header className="mb-8 lg:mb-12">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Configure your audio scope preferences and appearance
          </p>
        </header>

        {}
        <Section
          icon={<Palette size={20} />}
          title="Appearance"
          description="Customize how Audio Scope View looks"
        >
          <SettingsCard>
            <SettingsRow label="Theme" description="Choose your preferred color scheme">
              <div className="flex gap-1 p-1 rounded-md bg-background border border-border-subtle">
                {[
                  { value: "light", icon: Sun, label: "Light" },
                  { value: "dark", icon: Moon, label: "Dark" },
                  { value: "system", icon: Monitor, label: "System" },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setTheme(value as "light" | "dark" | "system");
                      addToast("success", `Theme changed to ${label}`);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-sm text-xs font-medium transition-all",
                      theme === value
                        ? "bg-bg-elevated text-foreground shadow-sm"
                        : "text-text-secondary hover:text-foreground",
                    )}
                  >
                    <Icon size={14} />
                    <span className="hidden xs:inline">{label}</span>
                  </button>
                ))}
              </div>
            </SettingsRow>

            <SettingsRow
              label="Waveform Color"
              description="Choose trace color for waveform display"
              border={false}
            >
              <div className="flex gap-2">
                {WAVEFORM_COLORS.map(({ value, color }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setWaveformColor(value);
                      addToast("success", `Waveform color changed to ${value}`);
                    }}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all relative flex-shrink-0",
                      waveformColor === value &&
                        "ring-2 ring-white ring-offset-2 ring-offset-background",
                    )}
                    style={{ backgroundColor: color }}
                    title={value.charAt(0).toUpperCase() + value.slice(1)}
                  />
                ))}
              </div>
            </SettingsRow>
          </SettingsCard>
        </Section>

        {}
        <Section
          icon={<Mic size={20} />}
          title="Audio"
          description="Configure microphone and capture settings"
        >
          <SettingsCard>
            <SettingsRow
              label="Input Device"
              description="Select the microphone or audio input device"
            >
              <div className="relative w-full sm:w-auto sm:min-w-[180px]">
                <select
                  className="w-full appearance-none bg-background border border-border rounded-md px-4 py-2.5 pr-10 text-sm font-medium text-foreground cursor-pointer hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedDeviceId ?? ""}
                  onChange={(_event) => {
                    setSelectedDeviceId(_event.target.value);
                    const device = devices?.find((d) => d.deviceId === _event.target.value);
                    addToast("success", `Input device changed to ${device?.label || "new device"}`);
                  }}
                >
                  {devices && devices.length > 0 ? (
                    devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))
                  ) : (
                    <option value="">No devices found</option>
                  )}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
              </div>
            </SettingsRow>

            <SettingsRow label="Sample Rate" description="Sample rate for test mode waveform generation">
              <div className="relative w-full sm:w-auto sm:min-w-[180px]">
                <select
                  className="w-full appearance-none bg-background border border-border rounded-md px-4 py-2.5 pr-10 text-sm font-medium text-foreground cursor-pointer hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-primary"
                  value={sampleRate || ""}
                  onChange={(_event) => {
                    setSampleRate(Number(_event.target.value));
                    addToast(
                      "success",
                      `Sample rate changed to ${sampleRateOptions.find((o) => o.value === Number(_event.target.value))?.label}`,
                    );
                  }}
                >
                  <option value="">Select sample rate</option>
                  {sampleRateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
              </div>
            </SettingsRow>

            <SettingsRow label="Buffer Size" description="Audio buffer for capture">
              <div className="relative w-full sm:w-auto sm:min-w-[180px]">
                <select
                  className="w-full appearance-none bg-background border border-border rounded-md px-4 py-2.5 pr-10 text-sm font-medium text-foreground cursor-pointer hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-primary"
                  value={bufferSize || ""}
                  onChange={(_event) => {
                    setBufferSize(Number(_event.target.value));
                    addToast(
                      "success",
                      `Buffer size changed to ${bufferSizeOptions.find((o) => o.value === Number(_event.target.value))?.label}`,
                    );
                  }}
                >
                  <option value="">Select buffer size</option>
                  {bufferSizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
              </div>
            </SettingsRow>

            <div className="px-4 sm:px-6 py-4 bg-bg-elevated border-t border-border-subtle">
              <div className="flex items-center gap-3">
                <span className={cn("w-2 h-2 rounded-full", permission.className)} />
                <span className="text-sm text-text-secondary">{permission.text}</span>
              </div>
            </div>
          </SettingsCard>
        </Section>

        {}
        <Section
          icon={<MonitorCheck size={20} />}
          title="Display"
          description="Adjust waveform visualization options"
        >
          <SettingsCard>
            <SettingsRow label="Show Grid" description="Display grid overlay on waveform">
              <button
                onClick={() => {
                  setShowGrid(!showGrid);
                  addToast("success", `Grid ${showGrid ? "disabled" : "enabled"}`);
                }}
                className={cn(
                  "relative w-12 h-7 rounded-full transition-all cursor-pointer flex-shrink-0",
                  showGrid ? "bg-accent border-accent" : "bg-background border border-border",
                )}
                role="switch"
                aria-checked={showGrid}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    showGrid && "translate-x-5",
                  )}
                />
              </button>
            </SettingsRow>

            <SettingsRow
              label="Show Measurements"
              description="Display amplitude and frequency measurements"
            >
              <button
                onClick={() => {
                  setShowMeasurements(!showMeasurements);
                  addToast("success", `Measurements ${showMeasurements ? "disabled" : "enabled"}`);
                }}
                className={cn(
                  "relative w-12 h-7 rounded-full transition-all cursor-pointer flex-shrink-0",
                  showMeasurements
                    ? "bg-accent border-accent"
                    : "bg-background border border-border",
                )}
                role="switch"
                aria-checked={showMeasurements}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    showMeasurements && "translate-x-5",
                  )}
                />
              </button>
            </SettingsRow>

            <SettingsRow
              label="Smooth Waveform"
              description="Apply smoothing filter to waveform display"
              border={false}
            >
              <button
                onClick={() => {
                  setSmoothWaveform(!smoothWaveform);
                  addToast("success", `Smooth waveform ${smoothWaveform ? "disabled" : "enabled"}`);
                }}
                className={cn(
                  "relative w-12 h-7 rounded-full transition-all cursor-pointer flex-shrink-0",
                  smoothWaveform ? "bg-accent border-accent" : "bg-background border border-border",
                )}
                role="switch"
                aria-checked={smoothWaveform}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
                    smoothWaveform && "translate-x-5",
                  )}
                />
              </button>
            </SettingsRow>
          </SettingsCard>
        </Section>

        {}
        <Section
          icon={<Eye size={20} />}
          title="Preview"
          description="See your current display settings in action"
        >
          <SettingsCard>
            <div className="p-4 sm:p-6">
              <div className="h-20 bg-background border border-border-subtle rounded-md relative overflow-hidden">
                {showGrid && (
                  <div
                    className="absolute inset-0 opacity-50"
                    style={{
                      backgroundImage:
                        "linear-gradient(90deg, var(--color-border-subtle) 1px, transparent 1px), linear-gradient(var(--color-border-subtle) 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                    }}
                  />
                )}
                <div className="absolute inset-0 flex items-center">
                  <div
                    className="w-full h-0.5 opacity-80"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${WAVEFORM_COLORS.find((c) => c.value === waveformColor)?.color} 10%, ${WAVEFORM_COLORS.find((c) => c.value === waveformColor)?.color} 15%, transparent 20%, transparent 25%, ${WAVEFORM_COLORS.find((c) => c.value === waveformColor)?.color} 30%, ${WAVEFORM_COLORS.find((c) => c.value === waveformColor)?.color} 35%, transparent 40%, transparent 100%)`,
                    }}
                  />
                </div>
              </div>
            </div>
          </SettingsCard>
        </Section>

        {}
        <Section icon={<Info size={20} />} title="About" description="Application information">
          <SettingsCard>
            <SettingsRow label="Version" border={false}>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-background border border-border-subtle rounded-md text-sm font-mono text-text-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {APP_VERSION}
              </div>
            </SettingsRow>
          </SettingsCard>
        </Section>
      </div>
    </div>
  );
}
