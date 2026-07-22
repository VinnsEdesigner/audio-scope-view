/**
 * ScopeDetail - Individual scope page with waveform display and controls
 * Shows real-time waveform, settings, and capture controls
 */

import { useParams } from "react-router-dom";
import { styled, YStack, XStack, Text } from "tamagui";
import { useScopeDetail, useWaveformStream, useSettings } from "@/hooks";
import { useUIStore } from "@/store";
import { WaveformDisplay } from "@/components/scope";
import { Button } from "@audio-scope-view/ui/button";
import { Slider } from "@audio-scope-view/ui/slider";
import { Switch } from "@audio-scope-view/ui/switch";
import { ScopeDetailSkeleton } from "@audio-scope-view/ui/skeletons";

const PageContainer = styled(YStack, {
  padding: "$lg",
  gap: "$lg",
  maxWidth: 1200,
  alignSelf: "center",
  width: "100%",
});

const PageHeader = styled(YStack, {
  gap: "$xs",
});

const BackLink = styled(XStack, {
  alignItems: "center",
  gap: "$xs",
  cursor: "pointer",
  hoverStyle: {
    opacity: 0.8,
  },
});

const BackText = styled(Text, {
  fontSize: "$sm",
  color: "$primary",
});

const PageTitle = styled(Text, {
  fontSize: "$2xl",
  fontWeight: "bold",
  color: "$foreground",
});

const WaveformSection = styled(YStack, {
  gap: "$md",
});

const WaveformContainer = styled(YStack, {
  backgroundColor: "$card",
  borderRadius: "$lg",
  borderWidth: 1,
  borderColor: "$border",
  padding: "$md",
  minHeight: 350,
});

const ControlsSection = styled(YStack, {
  gap: "$md",
});

const ControlRow = styled(XStack, {
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: "$sm",
  borderBottomWidth: 1,
  borderBottomColor: "$border",
});

const ControlLabel = styled(Text, {
  fontSize: "$sm",
  color: "$foreground",
});

const ControlValue = styled(Text, {
  fontSize: "$sm",
  color: "$mutedForeground",
});

const StatsRow = styled(XStack, {
  gap: "$lg",
  padding: "$md",
  backgroundColor: "$muted",
  borderRadius: "$md",
});

const StatItem = styled(YStack, {
  alignItems: "center",
  gap: "$xs",
});

const StatValue = styled(Text, {
  fontSize: "$lg",
  fontWeight: "bold",
  color: "$foreground",
});

const StatLabel = styled(Text, {
  fontSize: "$xs",
  color: "$mutedForeground",
});

const ActionRow = styled(XStack, {
  gap: "$md",
  justifyContent: "flex-end",
});

export function ScopeDetail(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const { data: scope, isLoading } = useScopeDetail(id);
  const { data: settings } = useSettings(id);
  const waveformStream = useWaveformStream({ scopeId: id, enabled: Boolean(id) });
  const { waveformColor } = useUIStore();

  if (isLoading || !scope) {
    return (
      <PageContainer>
        <ScopeDetailSkeleton />
      </PageContainer>
    );
  }

  const isCapturing = waveformStream.isConnected;

  const handleStopCapture = () => {
    waveformStream.disconnect();
  };

  return (
    <PageContainer>
      <PageHeader>
        <BackLink>
          <Text fontSize="$sm" color="$primary">
            ←
          </Text>
          <BackText>Back to Scopes</BackText>
        </BackLink>
        <PageTitle>{scope.name}</PageTitle>
        {scope.description && (
          <Text fontSize="$sm" color="$mutedForeground">
            {scope.description}
          </Text>
        )}
      </PageHeader>

      <WaveformSection>
        <WaveformContainer>
          <WaveformDisplay
            width={800}
            height={300}
            showGrid={settings?.showGrid ?? true}
            showTrigger={true}
            showTimeMarkers={true}
            waveformColor={waveformColor}
          />
        </WaveformContainer>

        <StatsRow>
          <StatItem>
            <StatValue>{scope.sampleRate.toLocaleString()}</StatValue>
            <StatLabel>Sample Rate (Hz)</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{scope.bufferSize}</StatValue>
            <StatLabel>Buffer Size</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{waveformStream.waveform?.samples?.length ?? 0}</StatValue>
            <StatLabel>Samples</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{isCapturing ? "Live" : "Stopped"}</StatValue>
            <StatLabel>Status</StatLabel>
          </StatItem>
        </StatsRow>
      </WaveformSection>

      <ControlsSection>
        <ControlRow>
          <ControlLabel>Time Scale</ControlLabel>
          <XStack alignItems="center" gap="$md">
            <Slider
              value={[settings?.timeScale ?? 1]}
              min={0.1}
              max={10}
              step={0.1}
              width={120}
              onValueChange={(_value) => {
                // Update time scale setting
              }}
            />
            <ControlValue>{settings?.timeScale ?? 1} ms/div</ControlValue>
          </XStack>
        </ControlRow>

        <ControlRow>
          <ControlLabel>Voltage Scale</ControlLabel>
          <XStack alignItems="center" gap="$md">
            <Slider
              value={[settings?.voltageScale ?? 1]}
              min={0.1}
              max={10}
              step={0.1}
              width={120}
              onValueChange={(_value) => {
                // Update voltage scale setting
              }}
            />
            <ControlValue>{settings?.voltageScale ?? 1} V/div</ControlValue>
          </XStack>
        </ControlRow>

        <ControlRow>
          <ControlLabel>Trigger Level</ControlLabel>
          <ControlValue>{((settings?.triggerLevel ?? 0.5) * 100).toFixed(0)}%</ControlValue>
        </ControlRow>

        <ControlRow>
          <ControlLabel>Show Grid</ControlLabel>
          <Switch
            checked={settings?.showGrid ?? true}
            onCheckedChange={(_checked) => {
              // Update show grid setting
            }}
          />
        </ControlRow>

        <ControlRow>
          <ControlLabel>Show Measurements</ControlLabel>
          <Switch
            checked={settings?.showMeasurements ?? true}
            onCheckedChange={(_checked) => {
              // Update show measurements setting
            }}
          />
        </ControlRow>
      </ControlsSection>

      <ActionRow>
        {isCapturing && (
          <Button onPress={handleStopCapture} variant="destructive">
            Stop Capture
          </Button>
        )}
        <Button variant="outline">Configure</Button>
      </ActionRow>
    </PageContainer>
  );
}
