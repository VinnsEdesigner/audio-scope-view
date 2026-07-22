/**
 * Settings - Application settings page
 * Theme, audio device, waveform color, and general app configuration
 */

import { styled, YStack, XStack, Text } from "tamagui";
import { Sun, Moon, Monitor } from "lucide-react";
import { useUIStore, useMediaDevices } from "@/hooks";
import type { WaveformColor } from "@/store/ui-store";
import { Switch } from "@audio-scope-view/ui/switch";
import { DeviceListSkeleton } from "@audio-scope-view/ui/skeletons";
import type { MediaDevice } from "../store";

// Waveform color options (blue, red, teal)
const WAVEFORM_COLORS: { value: WaveformColor; label: string; color: string }[] = [
  { value: "blue", label: "Blue", color: "#3b82f6" },
  { value: "red", label: "Red", color: "#ef4444" },
  { value: "teal", label: "Teal", color: "#14b8a6" },
];

const PageContainer = styled(YStack, {
  padding: "$lg",
  gap: "$lg",
  maxWidth: 600,
  alignSelf: "center",
  width: "100%",
});

const PageHeader = styled(YStack, {
  gap: "$xs",
});

const PageTitle = styled(Text, {
  fontSize: "$3xl",
  fontWeight: "bold",
  color: "$foreground",
});

const PageDescription = styled(Text, {
  fontSize: "$md",
  color: "$mutedForeground",
});

const Section = styled(YStack, {
  gap: "$md",
});

const SectionTitle = styled(Text, {
  fontSize: "$lg",
  fontWeight: "600",
  color: "$foreground",
  paddingBottom: "$sm",
  borderBottomWidth: 1,
  borderBottomColor: "$border",
});

const SettingRow = styled(XStack, {
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: "$sm",
});

const SettingLabel = styled(YStack, {
  gap: "$xs",
  flex: 1,
});

const SettingName = styled(Text, {
  fontSize: "$md",
  color: "$foreground",
});

const SettingDescription = styled(Text, {
  fontSize: "$sm",
  color: "$mutedForeground",
});

const ThemeSelector = styled(XStack, {
  gap: "$sm",
});

const DeviceSelector = styled(XStack, {
  flexWrap: "wrap",
  gap: "$sm",
});

const DeviceName = styled(Text, {
  fontSize: "$sm",
  color: "$foreground",
});

const ColorSelector = styled(XStack, {
  flexWrap: "wrap",
  gap: "$xs",
});

interface ThemeButtonProperties {
  children: React.ReactNode;
  onClick: () => void;
  isSelected: boolean;
  isDarkMode: boolean;
}

function getThemeBackgroundColor(isSelected: boolean, isDarkMode: boolean): string {
  if (!isSelected) return "transparent";
  return isDarkMode ? "rgba(var(--color-primary-rgb), 0.2)" : "rgba(var(--color-primary-rgb), 0.1)";
}

function ThemeButton({ children, onClick, isSelected, isDarkMode }: ThemeButtonProperties) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: "6px",
        borderWidth: 2,
        borderStyle: "solid",
        borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
        backgroundColor: getThemeBackgroundColor(isSelected, isDarkMode),
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexDirection: "row",
      }}
    >
      {children}
    </button>
  );
}

interface DeviceButtonProperties {
  children: React.ReactNode;
  onClick: () => void;
  isSelected: boolean;
}

function DeviceButton({ children, onClick, isSelected }: DeviceButtonProperties) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: "6px",
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
        backgroundColor: isSelected ? "var(--color-accent)" : "transparent",
        cursor: "pointer",
        display: "flex",
        flexDirection: "row",
      }}
    >
      {children}
    </button>
  );
}

interface ColorButtonProperties {
  color: string;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

function ColorButton({ color, label, isSelected, onClick }: ColorButtonProperties) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        borderWidth: isSelected ? 3 : 1,
        borderStyle: "solid",
        borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
        backgroundColor: color,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    />
  );
}

function getPermissionText(permissionState: string): string {
  switch (permissionState) {
    case "granted": {
      return "Granted";
    }
    case "denied": {
      return "Denied";
    }
    default: {
      return "Not requested";
    }
  }
}

function DeviceListContent({
  devices,
  devicesLoading,
  selectedDeviceId,
  setSelectedDeviceId,
}: {
  devices: MediaDevice[] | undefined;
  devicesLoading: boolean;
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string) => void;
}): React.ReactElement {
  if (devicesLoading) {
    return <DeviceListSkeleton />;
  }

  if (devices && devices.length > 0) {
    return (
      <DeviceSelector>
        {devices.map((device) => (
          <DeviceButton
            key={device.deviceId}
            onClick={() => setSelectedDeviceId(device.deviceId)}
            isSelected={selectedDeviceId === device.deviceId}
          >
            <DeviceName>{device.label || `Microphone ${device.deviceId.slice(0, 8)}`}</DeviceName>
          </DeviceButton>
        ))}
      </DeviceSelector>
    );
  }

  return (
    <Text fontSize="$sm" color="$mutedForeground">
      No audio input devices found
    </Text>
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
  const devicesLoading = devices === undefined;

  const isDarkMode =
    theme === "dark" ||
    (theme === "system" && globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const isSelected = (checkTheme: string) => theme === checkTheme;

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Settings</PageTitle>
        <PageDescription>Configure your audio scope preferences</PageDescription>
      </PageHeader>

      <Section>
        <SectionTitle>Appearance</SectionTitle>

        <SettingRow>
          <SettingLabel>
            <SettingName>Theme</SettingName>
            <SettingDescription>Choose how Audio Scope View looks</SettingDescription>
          </SettingLabel>
        </SettingRow>

        <ThemeSelector>
          <ThemeButton
            onClick={() => setTheme("light")}
            isSelected={isSelected("light")}
            isDarkMode={isDarkMode}
          >
            <Sun size={18} />
            <Text fontSize="$sm">Light</Text>
          </ThemeButton>

          <ThemeButton
            onClick={() => setTheme("dark")}
            isSelected={isSelected("dark")}
            isDarkMode={isDarkMode}
          >
            <Moon size={18} />
            <Text fontSize="$sm">Dark</Text>
          </ThemeButton>

          <ThemeButton
            onClick={() => setTheme("system")}
            isSelected={isSelected("system")}
            isDarkMode={isDarkMode}
          >
            <Monitor size={18} />
            <Text fontSize="$sm">System</Text>
          </ThemeButton>
        </ThemeSelector>
      </Section>

      <Section>
        <SectionTitle>Audio</SectionTitle>

        <SettingRow>
          <SettingLabel>
            <SettingName>Input Device</SettingName>
            <SettingDescription>Select the microphone or audio input device</SettingDescription>
          </SettingLabel>
        </SettingRow>

        <DeviceListContent
          devices={devices}
          devicesLoading={devicesLoading}
          selectedDeviceId={selectedDeviceId ?? null}
          setSelectedDeviceId={setSelectedDeviceId}
        />

        <SettingRow>
          <SettingLabel>
            <SettingName>Permission Status</SettingName>
            <SettingDescription>Microphone access permission</SettingDescription>
          </SettingLabel>
          <Text
            fontSize="$sm"
            color={permissionState === "granted" ? "$green" : "$mutedForeground"}
          >
            {getPermissionText(permissionState)}
          </Text>
        </SettingRow>
      </Section>

      <Section>
        <SectionTitle>Display</SectionTitle>

        <SettingRow>
          <SettingLabel>
            <SettingName>Show Grid</SettingName>
            <SettingDescription>Display grid overlay on waveform</SettingDescription>
          </SettingLabel>
          <Switch checked={showGrid} onCheckedChange={setShowGrid} />
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingName>Show Measurements</SettingName>
            <SettingDescription>Display amplitude and frequency measurements</SettingDescription>
          </SettingLabel>
          <Switch checked={showMeasurements} onCheckedChange={setShowMeasurements} />
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingName>Smooth Waveform</SettingName>
            <SettingDescription>Apply smoothing filter to waveform display</SettingDescription>
          </SettingLabel>
          <Switch checked={smoothWaveform} onCheckedChange={setSmoothWaveform} />
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingName>Waveform Color</SettingName>
            <SettingDescription>Choose trace color for waveform display</SettingDescription>
          </SettingLabel>
        </SettingRow>
        <ColorSelector>
          {WAVEFORM_COLORS.map(({ value, label, color }) => (
            <ColorButton
              key={value}
              color={color}
              label={label}
              isSelected={waveformColor === value}
              onClick={() => setWaveformColor(value)}
            />
          ))}
        </ColorSelector>
      </Section>

      <Section>
        <SectionTitle>About</SectionTitle>

        <SettingRow>
          <SettingLabel>
            <SettingName>Version</SettingName>
          </SettingLabel>
          <Text fontSize="$sm" color="$mutedForeground">
            1.0.0
          </Text>
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingName>Audio Scope View</SettingName>
            <SettingDescription>
              Turn your phone's microphone into an oscilloscope
            </SettingDescription>
          </SettingLabel>
        </SettingRow>
      </Section>
    </PageContainer>
  );
}
