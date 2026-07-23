/**
 * ScopeBottomBar - Bottom information bar
 */

import { useState } from "react";
import { styled, XStack, Stack, Text } from "tamagui";

const BottomBarContainer = styled(XStack, {
  height: 48,
  backgroundColor: "$gray2",
  borderTopWidth: 1,
  borderTopColor: "rgba(255, 255, 255, 0.06)",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 20,
});

const BottomInfo = styled(XStack, {
  gap: 24,
});

const InfoItem = styled(XStack, {
  alignItems: "center",
  gap: 8,
});

const InfoLabel = styled(Text, {
  fontSize: 12,
  color: "$gray9",
});

const InfoValue = styled(Text, {
  fontSize: 12,
  color: "$gray11",
  fontFamily: "monospace",
});

const ViewToggle = styled(XStack, {
  backgroundColor: "$gray1",
  borderRadius: 6,
  padding: 2,
});

const ViewToggleButton = styled(Stack, {
  paddingVertical: 6,
  paddingHorizontal: 12,
  borderRadius: 4,
  cursor: "pointer",
});

const ViewToggleText = styled(Text, {
  fontSize: 12,
  fontWeight: "500",
});

interface ScopeBottomBarProperties {
  sampleRate?: number;
  bufferSize?: number;
  timeWindow?: number;
  viewMode?: "time" | "spectrum";
  onViewModeChange?: (mode: "time" | "spectrum") => void;
}

export function ScopeBottomBar({
  sampleRate = 48000,
  bufferSize = 1024,
  timeWindow = 10,
  viewMode = "time",
  onViewModeChange,
}: ScopeBottomBarProperties): React.ReactElement {
  return (
    <BottomBarContainer>
      <BottomInfo>
        <InfoItem>
          <InfoLabel>Sample Rate:</InfoLabel>
          <InfoValue>{(sampleRate / 1000).toFixed(1)} kHz</InfoValue>
        </InfoItem>
        <InfoItem>
          <InfoLabel>Buffer:</InfoLabel>
          <InfoValue>{bufferSize}</InfoValue>
        </InfoItem>
        <InfoItem>
          <InfoLabel>Time:</InfoLabel>
          <InfoValue>{timeWindow.toFixed(1)} ms</InfoValue>
        </InfoItem>
      </BottomInfo>

      <ViewToggle>
        <ViewToggleButton
          backgroundColor={viewMode === "time" ? "$gray3" : "transparent"}
          onPress={() => onViewModeChange?.("time")}
        >
          <ViewToggleText color={viewMode === "time" ? "$gray12" : "$gray9"}>Time</ViewToggleText>
        </ViewToggleButton>
        <ViewToggleButton
          backgroundColor={viewMode === "spectrum" ? "$gray3" : "transparent"}
          onPress={() => onViewModeChange?.("spectrum")}
        >
          <ViewToggleText color={viewMode === "spectrum" ? "$gray12" : "$gray9"}>Spectrum</ViewToggleText>
        </ViewToggleButton>
      </ViewToggle>
    </BottomBarContainer>
  );
}
