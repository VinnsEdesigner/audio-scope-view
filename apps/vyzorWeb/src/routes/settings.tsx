/**
 * Settings - Application settings page
 */

import { XStack } from "tamagui";
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
import type { WaveformColor } from "@/store/ui-store";
import { APP_VERSION } from "@audio-scope-view/api-client";

// Waveform color options
const WAVEFORM_COLORS: { value: WaveformColor; colorClass: string }[] = [
  { value: "cyan", colorClass: "color-cyan" },
  { value: "blue", colorClass: "color-blue" },
  { value: "purple", colorClass: "color-purple" },
  { value: "green", colorClass: "color-green" },
  { value: "orange", colorClass: "color-orange" },
  { value: "red", colorClass: "color-red" },
];

function getPermissionStatus(permissionState: string): { text: string; statusClass: string } {
  switch (permissionState) {
    case "granted":
      return { text: "Microphone access granted", statusClass: "success" };
    case "denied":
      return { text: "Microphone access denied", statusClass: "error" };
    default:
      return { text: "Microphone access permission required", statusClass: "warning" };
  }
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
  const permission = getPermissionStatus(permissionState);

  // Sample rate options in Hz
  const sampleRateOptions = [
    { value: 44100, label: "44.1 kHz" },
    { value: 48000, label: "48 kHz" },
    { value: 96000, label: "96 kHz" },
  ];

  // Buffer size options in samples
  const bufferSizeOptions = [
    { value: 256, label: "256 samples" },
    { value: 512, label: "512 samples" },
    { value: 1024, label: "1024 samples" },
  ];

  return (
    <div className="settings-page">
      {/* Header */}
      <header className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-description">Configure your audio scope preferences and appearance</p>
      </header>

      {/* Appearance Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Palette size={20} />
          </div>
          <div className="section-title-group">
            <h2 className="section-title">Appearance</h2>
            <p className="section-description">Customize how Audio Scope View looks</p>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Theme</div>
              <div className="settings-label-description">Choose your preferred color scheme</div>
            </div>
            <div className="settings-control">
              <div className="theme-selector">
                <button
                  className={`theme-option ${theme === "light" ? "active" : ""}`}
                  onClick={() => setTheme("light")}
                >
                  <XStack alignItems="center" gap={6}>
                    <Sun size={14} />
                    <span>Light</span>
                  </XStack>
                </button>
                <button
                  className={`theme-option ${theme === "dark" ? "active" : ""}`}
                  onClick={() => setTheme("dark")}
                >
                  <XStack alignItems="center" gap={6}>
                    <Moon size={14} />
                    <span>Dark</span>
                  </XStack>
                </button>
                <button
                  className={`theme-option ${theme === "system" ? "active" : ""}`}
                  onClick={() => setTheme("system")}
                >
                  <XStack alignItems="center" gap={6}>
                    <Monitor size={14} />
                    <span>System</span>
                  </XStack>
                </button>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Waveform Color</div>
              <div className="settings-label-description">Choose trace color for waveform display</div>
            </div>
            <div className="settings-control">
              <div className="color-options">
                {WAVEFORM_COLORS.map(({ value, colorClass }) => (
                  <button
                    key={value}
                    className={`color-option ${colorClass} ${waveformColor === value ? "selected" : ""}`}
                    onClick={() => setWaveformColor(value)}
                    title={value.charAt(0).toUpperCase() + value.slice(1)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Audio Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Mic size={20} />
          </div>
          <div className="section-title-group">
            <h2 className="section-title">Audio</h2>
            <p className="section-description">Configure microphone and capture settings</p>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Input Device</div>
              <div className="settings-label-description">Select the microphone or audio input device</div>
            </div>
            <div className="settings-control">
              <div className="select-wrapper">
                <select
                  className="select"
                  value={selectedDeviceId ?? ""}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
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
                <div className="select-arrow">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Sample Rate</div>
              <div className="settings-label-description">Audio sampling frequency</div>
            </div>
            <div className="settings-control">
              <div className="select-wrapper">
                <select
                  className="select"
                  value={sampleRate || ""}
                  onChange={(e) => setSampleRate(Number(e.target.value))}
                >
                  <option value="">Select sample rate</option>
                  {sampleRateOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="select-arrow">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Buffer Size</div>
              <div className="settings-label-description">Audio buffer for capture</div>
            </div>
            <div className="settings-control">
              <div className="select-wrapper">
                <select
                  className="select"
                  value={bufferSize || ""}
                  onChange={(e) => setBufferSize(Number(e.target.value))}
                >
                  <option value="">Select buffer size</option>
                  {bufferSizeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="select-arrow">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>

          <div className="status-row">
            <div className="status-item">
              <div className="status-indicator">
                <span className={`status-dot ${permission.statusClass}`} />
                <span>{permission.text}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Display Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <MonitorCheck size={20} />
          </div>
          <div className="section-title-group">
            <h2 className="section-title">Display</h2>
            <p className="section-description">Adjust waveform visualization options</p>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Show Grid</div>
              <div className="settings-label-description">Display grid overlay on waveform</div>
            </div>
            <div className="settings-control">
              <button
                className={`toggle ${showGrid ? "active" : ""}`}
                onClick={() => setShowGrid(!showGrid)}
                role="switch"
                aria-checked={showGrid}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Show Measurements</div>
              <div className="settings-label-description">Display amplitude and frequency measurements</div>
            </div>
            <div className="settings-control">
              <button
                className={`toggle ${showMeasurements ? "active" : ""}`}
                onClick={() => setShowMeasurements(!showMeasurements)}
                role="switch"
                aria-checked={showMeasurements}
              />
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Smooth Waveform</div>
              <div className="settings-label-description">Apply smoothing filter to waveform display</div>
            </div>
            <div className="settings-control">
              <button
                className={`toggle ${smoothWaveform ? "active" : ""}`}
                onClick={() => setSmoothWaveform(!smoothWaveform)}
                role="switch"
                aria-checked={smoothWaveform}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Preview Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Eye size={20} />
          </div>
          <div className="section-title-group">
            <h2 className="section-title">Preview</h2>
            <p className="section-description">See your current display settings in action</p>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="waveform-preview">
              {showGrid && <div className="waveform-grid" />}
              <div className="waveform-line" />
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="settings-section">
        <div className="section-header">
          <div className="section-icon">
            <Info size={20} />
          </div>
          <div className="section-title-group">
            <h2 className="section-title">About</h2>
            <p className="section-description">Application information</p>
          </div>
        </div>

        <div className="settings-card">
          <div className="settings-row">
            <div className="settings-row-content">
              <div className="settings-label">Version</div>
            </div>
            <div className="settings-control">
              <div className="version-badge">
                <span className="version-badge-dot" />
                {APP_VERSION}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
