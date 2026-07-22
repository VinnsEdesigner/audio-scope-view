/**
 * Settings - Application settings page
 * Theme, audio device, and general app configuration
 */

import { styled, YStack, XStack, Text, Spinner } from "tamagui";
import { useUIStore, useMediaDevices } from "@/hooks";
import { Select } from "@audio-scope-view/ui/select";
import { Switch } from "@audio-scope-view/ui/switch";

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

const ThemeOption = styled(XStack, {
  padding: "$sm",
  paddingHorizontal: "$md",
  borderRadius: "$md",
  borderWidth: 2,
  borderColor: "$border",
  cursor: "pointer",
  alignItems: "center",
  gap: "$xs",
  "&:hover": {
    borderColor: "$primary",
  },
});

const ThemeIcon = styled(Text, {
  fontSize: "$lg",
});

const LoadingContainer = styled(YStack, {
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
  padding: "$xl",
});

function handleDeviceChange(deviceId: string): void {
  // Update selected device
  console.log("Selected device:", deviceId);
}

export function Settings(): React.ReactElement {
  const setTheme = useUIStore((s) => s.setTheme);
  const { data: devices, isLoading: devicesLoading } = useMediaDevices();

  const currentTheme = useUIStore((s) => s.theme);

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
  };

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
          <ThemeOption
            as="button"
            onPress={() => handleThemeChange("light")}
            aria-pressed={currentTheme === "light"}
          >
            <ThemeIcon>☀️</ThemeIcon>
            <Text fontSize="$sm">Light</Text>
          </ThemeOption>

          <ThemeOption
            as="button"
            onPress={() => handleThemeChange("dark")}
            aria-pressed={currentTheme === "dark"}
          >
            <ThemeIcon>🌙</ThemeIcon>
            <Text fontSize="$sm">Dark</Text>
          </ThemeOption>

          <ThemeOption
            as="button"
            onPress={() => handleThemeChange("system")}
            aria-pressed={currentTheme === "system"}
          >
            <ThemeIcon>💻</ThemeIcon>
            <Text fontSize="$sm">System</Text>
          </ThemeOption>
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

        {devicesLoading ? (
          <LoadingContainer>
            <Spinner size="small" />
          </LoadingContainer>
        ) : (
          <Select value={devices?.[0]?.deviceId} onValueChange={handleDeviceChange}>
            {devices?.map((device) => (
              <Select.Trigger key={device.deviceId}>
                <Select.Value placeholder="Select device">
                  {device.label || `Device ${device.deviceId.slice(0, 8)}`}
                </Select.Value>
              </Select.Trigger>
            ))}
          </Select>
        )}

        <SettingRow>
          <SettingLabel>
            <SettingName>Permission Status</SettingName>
            <SettingDescription>Microphone access permission</SettingDescription>
          </SettingLabel>
          <Text fontSize="$sm" color="$mutedForeground">
            {devices ? "Granted" : "Not granted"}
          </Text>
        </SettingRow>
      </Section>

      <Section>
        <SectionTitle>Display</SectionTitle>

        <SettingRow>
          <SettingLabel>
            <SettingName>Show Grid by Default</SettingName>
            <SettingDescription>Display grid overlay on waveform</SettingDescription>
          </SettingLabel>
          <Switch defaultChecked />
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingName>Show Measurements</SettingName>
            <SettingDescription>Display amplitude and frequency measurements</SettingDescription>
          </SettingLabel>
          <Switch defaultChecked />
        </SettingRow>

        <SettingRow>
          <SettingLabel>
            <SettingName>Smooth Waveform</SettingName>
            <SettingDescription>Apply smoothing filter to waveform display</SettingDescription>
          </SettingLabel>
          <Switch />
        </SettingRow>
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
