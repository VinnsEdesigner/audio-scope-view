import * as React from "react";
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  Mic,
  MonitorCheck,
  RefreshCw,
  MoreVertical,
} from "lucide-react";
import { SelectDialog } from "@/components/dialogs/select-dialog";
import { useUIStore, useMediaDevices, useAudioSettings } from "@/hooks";
import { useToast } from "@/hooks";
import { useHeader } from "@/contexts/header-context";
import type { WaveformColor } from "@/store/ui-store";
import { cn } from "@/lib/utilities";

const WAVEFORM_COLORS: readonly { readonly value: WaveformColor; readonly color: string }[] = [
  { value: "cyan", color: "#06b6d4" },
  { value: "blue", color: "#3b82f6" },
  { value: "purple", color: "#8b5cf6" },
  { value: "green", color: "#22c55e" },
  { value: "orange", color: "#f97316" },
  { value: "red", color: "#ef4444" },
] as const;

const THEME_OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

const SAMPLE_RATE_OPTIONS = [
  { value: 44_100, label: "44.1 kHz" },
  { value: 48_000, label: "48 kHz" },
  { value: 96_000, label: "96 kHz" },
] as const;

const BUFFER_SIZE_OPTIONS = [
  { value: 256, label: "256 samples" },
  { value: 512, label: "512 samples" },
  { value: 1024, label: "1024 samples" },
] as const;

type Theme = "light" | "dark" | "system";

interface SectionProperties {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly children: React.ReactNode;
}

interface SettingsCardProperties {
  readonly children: React.ReactNode;
}

interface SettingsRowProperties {
  readonly label: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly border?: boolean;
}

interface ThemeSelectorProperties {
  readonly theme: Theme;
  readonly onThemeChange: (theme: Theme) => void;
  readonly onSuccess: (message: string) => void;
}

interface ColorPickerProperties {
  readonly selectedColor: WaveformColor;
  readonly onColorChange: (color: WaveformColor) => void;
  readonly onSuccess: (message: string) => void;
}

interface ToggleSwitchProperties {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly onSuccess: (message: string) => void;
  readonly enabledLabel: string;
  readonly disabledLabel: string;
}

function getPermissionStatus(permissionState: string): {
  readonly text: string;
  readonly className: string;
} {
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

const Section = React.memo(function Section({
  icon,
  title,
  description,
  children,
}: SectionProperties) {
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
});

const SettingsCard = React.memo(function SettingsCard({ children }: SettingsCardProperties) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-secondary overflow-hidden">
      {children}
    </div>
  );
});

const SettingsRow = React.memo(function SettingsRow({
  label,
  description,
  children,
  border = true,
}: SettingsRowProperties) {
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
});

const ThemeSelector = React.memo(function ThemeSelector({
  theme,
  onThemeChange,
  onSuccess,
}: ThemeSelectorProperties) {
  const handleThemeChange = React.useCallback(
    (selectedTheme: Theme) => {
      onThemeChange(selectedTheme);
      const label = THEME_OPTIONS.find((t) => t.value === selectedTheme)?.label ?? selectedTheme;
      onSuccess(`Theme changed to ${label}`);
    },
    [onThemeChange, onSuccess],
  );

  return (
    <div className="flex gap-1 p-1 rounded-md bg-background border border-border-subtle">
      {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => handleThemeChange(value)}
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
  );
});

const ColorPicker = React.memo(function ColorPicker({
  selectedColor,
  onColorChange,
  onSuccess,
}: ColorPickerProperties) {
  const handleColorChange = React.useCallback(
    (color: WaveformColor) => {
      onColorChange(color);
      onSuccess(`Waveform color changed to ${color}`);
    },
    [onColorChange, onSuccess],
  );

  return (
    <div className="flex gap-2">
      {WAVEFORM_COLORS.map(({ value, color }) => (
        <button
          key={value}
          onClick={() => handleColorChange(value)}
          className={cn(
            "w-8 h-8 rounded-full transition-all relative flex-shrink-0",
            selectedColor === value && "ring-2 ring-white ring-offset-2 ring-offset-background",
          )}
          style={{ backgroundColor: color }}
          title={value.charAt(0).toUpperCase() + value.slice(1)}
          aria-label={`Select ${value} color`}
        />
      ))}
    </div>
  );
});

const ToggleSwitch = React.memo(function ToggleSwitch({
  checked,
  onChange,
  onSuccess,
  enabledLabel,
  disabledLabel,
}: ToggleSwitchProperties) {
  const handleToggle = React.useCallback(() => {
    const newValue = !checked;
    onChange(newValue);
    onSuccess(`${newValue ? enabledLabel : disabledLabel}`);
  }, [checked, onChange, onSuccess, enabledLabel, disabledLabel]);

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "relative w-12 h-7 rounded-full transition-all cursor-pointer flex-shrink-0",
        checked ? "bg-accent border-accent" : "bg-background border border-border",
      )}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
});

const PermissionStatus = React.memo(function PermissionStatus({
  permissionState,
}: {
  readonly permissionState: string;
}) {
  const permission = React.useMemo(() => getPermissionStatus(permissionState), [permissionState]);

  return (
    <div className="px-4 sm:px-6 py-4 bg-bg-elevated border-t border-border-subtle">
      <div className="flex items-center gap-3">
        <span className={cn("w-2 h-2 rounded-full", permission.className)} />
        <span className="text-sm text-text-secondary">{permission.text}</span>
      </div>
    </div>
  );
});

export function Settings(): React.ReactElement {
  const { setContent } = useHeader();
  const [showDeviceInfo, setShowDeviceInfo] = React.useState(false);

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

  // Set header content
  React.useEffect(() => {
    setContent({
      title: "Settings",
      actions: (
        <button
          onClick={() => setShowDeviceInfo(!showDeviceInfo)}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-bg-elevated hover:bg-bg-hover border border-border-subtle transition-colors"
          title="Device Info"
        >
          <MoreVertical size={18} className="text-text-secondary" />
        </button>
      ),
    });
  }, [setContent, showDeviceInfo]);

  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    permissionState,
    systemInfo,
    requestPermission,
    refreshDevices,
  } = useMediaDevices();
  const { sampleRate, bufferSize, setSampleRate, setBufferSize } = useAudioSettings();
  const { addToast } = useToast();

  const showSuccessToast = React.useCallback(
    (message: string) => {
      addToast("success", message);
    },
    [addToast],
  );

  const handleRequestPermission = React.useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  const handleRefreshDevices = React.useCallback(async () => {
    await refreshDevices();
    addToast("success", "Devices refreshed");
  }, [refreshDevices, addToast]);

  const handleDeviceChange = React.useCallback(
    (value: string | number) => {
      setSelectedDeviceId(String(value));
      const device = devices?.find((d) => d.deviceId === String(value));
      addToast("success", `Input device changed to ${device?.label || "new device"}`);
    },
    [devices, setSelectedDeviceId, addToast],
  );

  const handleThemeChange = React.useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
    },
    [setTheme],
  );

  const handleColorChange = React.useCallback(
    (color: WaveformColor) => {
      setWaveformColor(color);
    },
    [setWaveformColor],
  );

  const handleGridToggle = React.useCallback(
    (checked: boolean) => {
      setShowGrid(checked);
    },
    [setShowGrid],
  );

  const handleMeasurementsToggle = React.useCallback(
    (checked: boolean) => {
      setShowMeasurements(checked);
    },
    [setShowMeasurements],
  );

  const handleSmoothWaveformToggle = React.useCallback(
    (checked: boolean) => {
      setSmoothWaveform(checked);
    },
    [setSmoothWaveform],
  );

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="w-full px-6 py-6 sm:px-8 md:px-10 lg:px-14 xl:px-20">
        {/* Device Info Dropdown */}
        {showDeviceInfo && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setShowDeviceInfo(false)} />
            <div className="fixed right-4 top-20 w-80 rounded-lg border border-border-subtle bg-bg-secondary shadow-lg z-[60] overflow-hidden">
              <div className="p-4 border-b border-border-subtle bg-bg-elevated">
                <h3 className="text-sm font-semibold text-foreground">Device Information</h3>
              </div>
              <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                {/* Browser Info */}
                <div>
                  <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                    Browser
                  </h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Name</span>
                      <span className="text-foreground font-mono">
                        {systemInfo?.browserName ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Version</span>
                      <span className="text-foreground font-mono">
                        {systemInfo?.browserVersion ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Permission Status */}
                <div>
                  <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                    Permission
                  </h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">Microphone</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          permissionState === "granted" && "bg-success",
                          permissionState === "denied" && "bg-destructive",
                          permissionState === "prompt" && "bg-warning",
                        )}
                      />
                      <span className="text-sm text-foreground capitalize">{permissionState}</span>
                    </div>
                  </div>
                  {permissionState !== "granted" && (
                    <button
                      onClick={handleRequestPermission}
                      className="mt-2 w-full px-3 py-2 text-xs font-medium rounded-md bg-accent text-white hover:bg-accent/90 transition-colors"
                    >
                      Request Permission
                    </button>
                  )}
                </div>

                {/* Audio System Info */}
                {systemInfo && (
                  <div>
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
                      Audio System
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Default Sample Rate</span>
                        <span className="text-foreground font-mono">
                          {(systemInfo.defaultSampleRate / 1000).toFixed(1)} kHz
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Max Channels</span>
                        <span className="text-foreground font-mono">{systemInfo.maxChannels}</span>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-text-secondary">Supported Rates</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {systemInfo.supportedSampleRates.map((rate) => (
                            <span
                              key={rate}
                              className={cn(
                                "px-2 py-0.5 text-xs rounded font-mono",
                                rate === sampleRate
                                  ? "bg-accent text-white"
                                  : "bg-bg-elevated text-text-secondary",
                              )}
                            >
                              {(rate / 1000).toFixed(1)} kHz
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Devices List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-text-tertiary uppercase tracking-wider">
                      Input Devices ({devices.length})
                    </h4>
                    <button
                      onClick={handleRefreshDevices}
                      className="p-1 text-text-secondary hover:text-foreground transition-colors"
                      title="Refresh devices"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                  {devices.length === 0 ? (
                    <p className="text-sm text-text-tertiary italic">No devices found</p>
                  ) : (
                    <div className="space-y-2">
                      {devices.map((device) => (
                        <div
                          key={device.deviceId}
                          className={cn(
                            "p-2 rounded-md text-sm",
                            device.deviceId === selectedDeviceId
                              ? "bg-accent/10 border border-accent/30"
                              : "bg-bg-elevated",
                          )}
                        >
                          <div className="font-medium text-foreground truncate">{device.label}</div>
                          <div className="text-xs text-text-tertiary font-mono mt-0.5">
                            ID: {device.deviceId.slice(0, 16)}...
                          </div>
                          <div className="text-xs text-text-tertiary mt-0.5">
                            Group: {device.groupId.slice(0, 16)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {}
        <Section
          icon={<Palette size={20} />}
          title="Appearance"
          description="Customize how Audio Scope View looks"
        >
          <SettingsCard>
            <SettingsRow label="Theme" description="Choose your preferred color scheme">
              <ThemeSelector
                theme={theme}
                onThemeChange={handleThemeChange}
                onSuccess={showSuccessToast}
              />
            </SettingsRow>

            <SettingsRow
              label="Waveform Color"
              description="Choose trace color for waveform display"
              border={false}
            >
              <ColorPicker
                selectedColor={waveformColor}
                onColorChange={handleColorChange}
                onSuccess={showSuccessToast}
              />
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
              <SelectDialog
                value={selectedDeviceId ?? ""}
                options={
                  devices?.map((device) => ({
                    value: device.deviceId,
                    label: device.label,
                  })) ?? []
                }
                placeholder={devices && devices.length > 0 ? "Select device" : "No devices found"}
                onChange={handleDeviceChange}
                triggerLabel="Input Device"
              />
            </SettingsRow>

            <SettingsRow
              label="Sample Rate"
              description="Audio sampling frequency. Not all rates are supported by all browsers and hardware (48kHz recommended)"
            >
              <SelectDialog
                value={sampleRate}
                options={SAMPLE_RATE_OPTIONS}
                placeholder="Select sample rate"
                onChange={(value) => setSampleRate(Number(value))}
                onSuccess={showSuccessToast}
                triggerLabel="Sample Rate"
              />
            </SettingsRow>

            <SettingsRow label="Buffer Size" description="Audio buffer for capture">
              <SelectDialog
                value={bufferSize}
                options={BUFFER_SIZE_OPTIONS}
                placeholder="Select buffer size"
                onChange={(value) => setBufferSize(Number(value))}
                onSuccess={showSuccessToast}
                triggerLabel="Buffer Size"
              />
            </SettingsRow>

            <PermissionStatus permissionState={permissionState} />
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
              <ToggleSwitch
                checked={showGrid}
                onChange={handleGridToggle}
                onSuccess={showSuccessToast}
                enabledLabel="Grid enabled"
                disabledLabel="Grid disabled"
              />
            </SettingsRow>

            <SettingsRow
              label="Show Measurements"
              description="Display amplitude and frequency measurements"
            >
              <ToggleSwitch
                checked={showMeasurements}
                onChange={handleMeasurementsToggle}
                onSuccess={showSuccessToast}
                enabledLabel="Measurements enabled"
                disabledLabel="Measurements disabled"
              />
            </SettingsRow>

            <SettingsRow
              label="Smooth Waveform"
              description="Apply smoothing filter to waveform display"
              border={false}
            >
              <ToggleSwitch
                checked={smoothWaveform}
                onChange={handleSmoothWaveformToggle}
                onSuccess={showSuccessToast}
                enabledLabel="Smooth waveform enabled"
                disabledLabel="Smooth waveform disabled"
              />
            </SettingsRow>
          </SettingsCard>
        </Section>
      </div>
    </div>
  );
}
