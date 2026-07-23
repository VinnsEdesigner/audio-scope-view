/**
 * ScopeControlPanel - Right side control panel with tabs
 */

import { useState } from "react";
import { styled, YStack, XStack, Text, Stack, Button } from "tamagui";
import { Slider } from "@audio-scope-view/ui/slider";
import { Switch } from "@audio-scope-view/ui/switch";

const PanelContainer = styled(Stack, {
  width: 280,
  backgroundColor: "$gray2",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.06)",
  borderRadius: 12,
  overflow: "hidden",
});

const PanelTabs = styled(XStack, {
  gap: 2,
  padding: 8,
  backgroundColor: "$gray1",
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255, 255, 255, 0.06)",
});

const PanelTab = styled(Stack, {
  flex: 1,
  paddingVertical: 8,
  paddingHorizontal: 12,
  borderRadius: 6,
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});

const PanelTabText = styled(Text, {
  fontSize: 12,
  fontWeight: "500",
});

const PanelContent = styled(YStack, {
  flex: 1,
  overflow: "hidden",
  padding: 16,
});

const PanelSection = styled(YStack, {
  marginBottom: 20,
});

const SectionTitle = styled(Text, {
  fontSize: 11,
  fontWeight: "600",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "$gray9",
  marginBottom: 12,
});

const ButtonGroup = styled(XStack, {
  gap: 8,
  marginBottom: 16,
});

const ActionButton = styled(Stack, {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 8,
  cursor: "pointer",
  flexDirection: "row",
});

const ActionButtonText = styled(Text, {
  fontSize: 13,
  fontWeight: "500",
});

const SliderContainer = styled(YStack, {
  marginBottom: 16,
});

const SliderHeader = styled(XStack, {
  justifyContent: "space-between",
  marginBottom: 8,
});

const SliderLabel = styled(Text, {
  fontSize: 13,
  color: "$gray11",
});

const SliderValue = styled(Text, {
  fontSize: 12,
  color: "$gray10",
  fontFamily: "monospace",
});

const CheckboxRow = styled(XStack, {
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 12,
});

const CheckboxLabel = styled(Text, {
  fontSize: 13,
  color: "$gray11",
});

const ColorPicker = styled(XStack, {
  gap: 8,
});

const ColorSwatch = styled(Stack, {
  width: 28,
  height: 28,
  borderRadius: 14,
  cursor: "pointer",
});

const MeasurementsGrid = styled(XStack, {
  flexWrap: "wrap",
  gap: 8,
});

const MeasurementCard = styled(YStack, {
  width: "calc(50% - 4px)",
  backgroundColor: "$gray1",
  borderRadius: 8,
  padding: 12,
  alignItems: "center",
});

const MeasurementValue = styled(Text, {
  fontSize: 18,
  fontWeight: "600",
  fontFamily: "monospace",
  color: "$gray10",
  marginBottom: 4,
});

const MeasurementLabel = styled(Text, {
  fontSize: 11,
  color: "$gray9",
  textTransform: "uppercase",
});

interface ControlPanelProperties {
  onRunChange?: (isRunning: boolean) => void;
}

export function ScopeControlPanel({ onRunChange }: ControlPanelProperties): React.ReactElement {
  const [activeTab, setActiveTab] = useState<"display" | "trigger" | "measure">("display");
  const [isRunning, setIsRunning] = useState(false);
  const [timeDiv, setTimeDiv] = useState(1.0);
  const [voltDiv, setVoltDiv] = useState(1.0);
  const [triggerLevel, setTriggerLevel] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showGlow, setShowGlow] = useState(false);
  const [traceColor, setTraceColor] = useState("teal");
  const [edgeMode, setEdgeMode] = useState<"rising" | "falling">("rising");

  const handleRunToggle = () => {
    const newState = !isRunning;
    setIsRunning(newState);
    onRunChange?.(newState);
  };

  return (
    <PanelContainer>
      <PanelTabs>
        <PanelTab
          backgroundColor={activeTab === "display" ? "$gray3" : "transparent"}
          onPress={() => setActiveTab("display")}
        >
          <PanelTabText color={activeTab === "display" ? "$gray12" : "$gray9"}>Display</PanelTabText>
        </PanelTab>
        <PanelTab
          backgroundColor={activeTab === "trigger" ? "$gray3" : "transparent"}
          onPress={() => setActiveTab("trigger")}
        >
          <PanelTabText color={activeTab === "trigger" ? "$gray12" : "$gray9"}>Trigger</PanelTabText>
        </PanelTab>
        <PanelTab
          backgroundColor={activeTab === "measure" ? "$gray3" : "transparent"}
          onPress={() => setActiveTab("measure")}
        >
          <PanelTabText color={activeTab === "measure" ? "$gray12" : "$gray9"}>Meas</PanelTabText>
        </PanelTab>
      </PanelTabs>

      <PanelContent overflow="scroll">
        {activeTab === "display" && (
          <>
            {/* Run/Stop Buttons */}
            <ButtonGroup>
              <ActionButton
                backgroundColor={isRunning ? "$gray4" : "$accent"}
                hoverStyle={{
                  backgroundColor: isRunning ? "$gray5" : "$accentHover",
                }}
                onPress={handleRunToggle}
              >
                {isRunning ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                    <ActionButtonText color={isRunning ? "$gray12" : "black"}>Stop</ActionButtonText>
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    <ActionButtonText color={isRunning ? "$gray12" : "black"}>Run</ActionButtonText>
                  </>
                )}
              </ActionButton>
              <ActionButton
                backgroundColor="$gray3"
                borderWidth={1}
                borderColor="rgba(255, 255, 255, 0.06)"
                hoverStyle={{ backgroundColor: "$gray4" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="$gray12" strokeWidth="2">
                  <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                <ActionButtonText color="$gray12">Freeze</ActionButtonText>
              </ActionButton>
            </ButtonGroup>

            {/* Time Base */}
            <PanelSection>
              <SectionTitle>Time Base</SectionTitle>
              <SliderContainer>
                <SliderHeader>
                  <SliderLabel>Time/Div</SliderLabel>
                  <SliderValue>{timeDiv.toFixed(1)} ms</SliderValue>
                </SliderHeader>
                <Slider
                  value={[timeDiv]}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onValueChange={([v]) => setTimeDiv(v)}
                  width="100%"
                />
              </SliderContainer>
            </PanelSection>

            {/* Vertical */}
            <PanelSection>
              <SectionTitle>Vertical</SectionTitle>
              <SliderContainer>
                <SliderHeader>
                  <SliderLabel>Volt/Div</SliderLabel>
                  <SliderValue>{voltDiv.toFixed(1)} V</SliderValue>
                </SliderHeader>
                <Slider
                  value={[voltDiv]}
                  min={0.1}
                  max={5}
                  step={0.1}
                  onValueChange={([v]) => setVoltDiv(v)}
                  width="100%"
                />
              </SliderContainer>
            </PanelSection>

            {/* Trace */}
            <PanelSection>
              <SectionTitle>Trace</SectionTitle>
              <CheckboxRow>
                <SliderLabel>Color</SliderLabel>
                <ColorPicker>
                  <ColorSwatch
                    backgroundColor="#14b8a6"
                    borderWidth={traceColor === "teal" ? 2 : 0}
                    borderColor="white"
                    onPress={() => setTraceColor("teal")}
                  />
                  <ColorSwatch
                    backgroundColor="#ef4444"
                    borderWidth={traceColor === "red" ? 2 : 0}
                    borderColor="white"
                    onPress={() => setTraceColor("red")}
                  />
                  <ColorSwatch
                    backgroundColor="#8b5cf6"
                    borderWidth={traceColor === "blue" ? 2 : 0}
                    borderColor="white"
                    onPress={() => setTraceColor("blue")}
                  />
                </ColorPicker>
              </CheckboxRow>
              <CheckboxRow>
                <CheckboxLabel>Grid</CheckboxLabel>
                <Switch checked={showGrid} onCheckedChange={setShowGrid} />
              </CheckboxRow>
              <CheckboxRow>
                <CheckboxLabel>Glow</CheckboxLabel>
                <Switch checked={showGlow} onCheckedChange={setShowGlow} />
              </CheckboxRow>
            </PanelSection>
          </>
        )}

        {activeTab === "trigger" && (
          <PanelSection>
            <SectionTitle>Trigger Mode</SectionTitle>
            <ButtonGroup>
              <ActionButton
                backgroundColor={edgeMode === "rising" ? "$accent" : "$gray3"}
                borderWidth={1}
                borderColor="rgba(255, 255, 255, 0.06)"
                onPress={() => setEdgeMode("rising")}
              >
                <ActionButtonText color={edgeMode === "rising" ? "black" : "$gray12"}>Rising</ActionButtonText>
              </ActionButton>
              <ActionButton
                backgroundColor={edgeMode === "falling" ? "$accent" : "$gray3"}
                borderWidth={1}
                borderColor="rgba(255, 255, 255, 0.06)"
                onPress={() => setEdgeMode("falling")}
              >
                <ActionButtonText color={edgeMode === "falling" ? "black" : "$gray12"}>Falling</ActionButtonText>
              </ActionButton>
            </ButtonGroup>
            <SliderContainer>
              <SliderHeader>
                <SliderLabel>Level</SliderLabel>
                <SliderValue>{triggerLevel.toFixed(2)} V</SliderValue>
              </SliderHeader>
              <Slider
                value={[triggerLevel]}
                min={-2}
                max={2}
                step={0.01}
                onValueChange={([v]) => setTriggerLevel(v)}
                width="100%"
              />
            </SliderContainer>
          </PanelSection>
        )}

        {activeTab === "measure" && (
          <PanelSection>
            <SectionTitle>Measurements</SectionTitle>
            <MeasurementsGrid>
              <MeasurementCard>
                <MeasurementValue>1.42</MeasurementValue>
                <MeasurementLabel>Vpp (V)</MeasurementLabel>
              </MeasurementCard>
              <MeasurementCard>
                <MeasurementValue>0.51</MeasurementValue>
                <MeasurementLabel>RMS (V)</MeasurementLabel>
              </MeasurementCard>
              <MeasurementCard>
                <MeasurementValue>1.02</MeasurementValue>
                <MeasurementLabel>Freq (kHz)</MeasurementLabel>
              </MeasurementCard>
              <MeasurementCard>
                <MeasurementValue>0.08</MeasurementValue>
                <MeasurementLabel>DC (V)</MeasurementLabel>
              </MeasurementCard>
            </MeasurementsGrid>
          </PanelSection>
        )}
      </PanelContent>
    </PanelContainer>
  );
}
