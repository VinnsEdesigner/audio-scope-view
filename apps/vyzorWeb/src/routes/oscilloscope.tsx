/**
 * Oscilloscope - Full oscilloscope page with all controls
 * Matches the professional oscilloscope UI design
 */

import { useState } from "react";
import { styled, XStack, YStack, Text, Stack } from "tamagui";
import { Slider } from "@audio-scope-view/ui/slider";
import { Switch } from "@audio-scope-view/ui/switch";

const PageContainer = styled(XStack, {
  flex: 1,
  height: "100vh",
  overflow: "hidden",
  backgroundColor: "$gray1",
});

// Sidebar
const SidebarContainer = styled(YStack, {
  width: 60,
  backgroundColor: "$gray2",
  borderRightWidth: 1,
  borderRightColor: "rgba(255, 255, 255, 0.06)",
  paddingVertical: 12,
  gap: 4,
});

const SidebarButton = styled(Stack, {
  width: 44,
  height: 44,
  marginHorizontal: "auto",
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});

const SidebarDivider = styled(Stack, {
  height: 1,
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  marginHorizontal: 12,
  marginVertical: 8,
});

// Main Area
const MainArea = styled(YStack, {
  flex: 1,
  overflow: "hidden",
});

// Top Bar
const TopBarContainer = styled(XStack, {
  height: 56,
  backgroundColor: "$gray2",
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255, 255, 255, 0.06)",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 20,
});

const TopBarLeft = styled(XStack, {
  alignItems: "center",
  gap: 16,
});

const MenuButton = styled(Stack, {
  width: 40,
  height: 40,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});

const ScopeTitle = styled(Text, {
  fontSize: 15,
  fontWeight: "600",
  color: "$gray12",
});

const StatusBadge = styled(XStack, {
  alignItems: "center",
  gap: 6,
});

const StatusDot = styled(Stack, {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: "$gray8",
});

const StatusDotLive = styled(Stack, {
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: "#22c55e",
});

const StatusText = styled(Text, {
  fontSize: 13,
  color: "$gray9",
});

const TopBarRight = styled(XStack, {
  alignItems: "center",
  gap: 8,
});

const IconButton = styled(Stack, {
  width: 36,
  height: 36,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});

// Canvas Area
const CanvasArea = styled(XStack, {
  flex: 1,
  padding: 20,
  gap: 16,
  overflow: "hidden",
});

const CanvasWrapper = styled(Stack, {
  flex: 1,
  backgroundColor: "$gray2",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.06)",
  borderRadius: 12,
  overflow: "hidden",
});

const CanvasHeader = styled(XStack, {
  height: 40,
  borderBottomWidth: 1,
  borderBottomColor: "rgba(255, 255, 255, 0.06)",
  alignItems: "center",
  justifyContent: "space-between",
  paddingHorizontal: 16,
  backgroundColor: "$gray3",
});

const CanvasLabel = styled(Text, {
  fontSize: 12,
  fontWeight: "500",
  color: "$gray11",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
});

const CanvasTime = styled(Text, {
  fontSize: 11,
  color: "$gray9",
  fontFamily: "monospace",
});

const CanvasContainer = styled(Stack, {
  flex: 1,
  position: "relative",
  backgroundColor: "#000",
});

// Control Panel
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
  overflow: "scroll",
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

// Bottom Bar
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

// Dropdown Menu
const DropdownMenu = styled(YStack, {
  position: "absolute",
  top: 56,
  left: 20,
  width: 240,
  backgroundColor: "$gray3",
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.06)",
  borderRadius: 12,
  shadowColor: "black",
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.5,
  shadowRadius: 32,
  zIndex: 1000,
  padding: 8,
});

const MenuItem = styled(XStack, {
  alignItems: "center",
  gap: 12,
  paddingVertical: 10,
  paddingHorizontal: 12,
  borderRadius: 8,
  cursor: "pointer",
});

const MenuItemText = styled(Text, {
  fontSize: 13,
  color: "$gray11",
});

const MenuDivider = styled(Stack, {
  height: 1,
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  marginVertical: 8,
});

export function Oscilloscope(): React.ReactElement {
  const [activeView, setActiveView] = useState<"scope" | "spectrum" | "measure">("scope");
  const [activeTab, setActiveTab] = useState<"display" | "trigger" | "measure">("display");
  const [isRunning, setIsRunning] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [timeDiv, setTimeDiv] = useState(1.0);
  const [voltDiv, setVoltDiv] = useState(1.0);
  const [triggerLevel, setTriggerLevel] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const [showGlow, setShowGlow] = useState(false);
  const [traceColor, setTraceColor] = useState("teal");
  const [edgeMode, setEdgeMode] = useState<"rising" | "falling">("rising");
  const [viewMode, setViewMode] = useState<"time" | "spectrum">("time");

  return (
    <PageContainer>
      {/* Sidebar */}
      <SidebarContainer>
        <SidebarButton
          backgroundColor={activeView === "scope" ? "$accent" : "transparent"}
          hoverStyle={{ backgroundColor: activeView === "scope" ? "$accentHover" : "$gray3" }}
          onPress={() => setActiveView("scope")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeView === "scope" ? "black" : "$gray11"} strokeWidth="2">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
          </svg>
        </SidebarButton>
        <SidebarButton
          backgroundColor={activeView === "spectrum" ? "$accent" : "transparent"}
          hoverStyle={{ backgroundColor: activeView === "spectrum" ? "$accentHover" : "$gray3" }}
          onPress={() => setActiveView("spectrum")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeView === "spectrum" ? "black" : "$gray11"} strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </SidebarButton>
        <SidebarButton
          backgroundColor={activeView === "measure" ? "$accent" : "transparent"}
          hoverStyle={{ backgroundColor: activeView === "measure" ? "$accentHover" : "$gray3" }}
          onPress={() => setActiveView("measure")}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeView === "measure" ? "black" : "$gray11"} strokeWidth="2">
            <path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z" />
          </svg>
        </SidebarButton>
        <SidebarDivider />
        <SidebarButton backgroundColor="transparent" hoverStyle={{ backgroundColor: "$gray3" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </SidebarButton>
        <SidebarButton backgroundColor="transparent" hoverStyle={{ backgroundColor: "$gray3" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4m0-4h.01" />
          </svg>
        </SidebarButton>
      </SidebarContainer>

      {/* Main Area */}
      <MainArea>
        {/* Top Bar */}
        <TopBarContainer>
          <TopBarLeft>
            <MenuButton
              backgroundColor="transparent"
              hoverStyle={{ backgroundColor: "$gray3" }}
              onPress={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="$gray10" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </MenuButton>

            {isMenuOpen && (
              <DropdownMenu>
                <MenuItem hoverStyle={{ backgroundColor: "$gray4" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v10M1 12h6m6 0h10" />
                  </svg>
                  <MenuItemText>Auto Setup</MenuItemText>
                </MenuItem>
                <MenuItem hoverStyle={{ backgroundColor: "$gray4" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
                    <path d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                  <MenuItemText>Default Setup</MenuItemText>
                </MenuItem>
                <MenuDivider />
                <MenuItem hoverStyle={{ backgroundColor: "$gray4" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5 5 5 5-5m-5 5V3" />
                  </svg>
                  <MenuItemText>Save Waveform</MenuItemText>
                </MenuItem>
                <MenuItem hoverStyle={{ backgroundColor: "$gray4" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M12 18v-6m-3 3 3-3 3 3" />
                  </svg>
                  <MenuItemText>Load Waveform</MenuItemText>
                </MenuItem>
                <MenuDivider />
                <MenuItem hoverStyle={{ backgroundColor: "$gray4" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v6m0 6v10M1 12h6m6 0h10" />
                  </svg>
                  <MenuItemText>Preferences</MenuItemText>
                </MenuItem>
              </DropdownMenu>
            )}

            <ScopeTitle>Scope 1</ScopeTitle>
            <StatusBadge>
              {isRunning ? <StatusDotLive /> : <StatusDot />}
              <StatusText>{isRunning ? "Live" : "Stopped"}</StatusText>
            </StatusBadge>
          </TopBarLeft>

          <TopBarRight>
            <IconButton backgroundColor="transparent" hoverStyle={{ backgroundColor: "$gray3" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray10" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </IconButton>
            <IconButton backgroundColor="transparent" hoverStyle={{ backgroundColor: "$gray3" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray10" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5 5 5 5-5m-5 5V3" />
              </svg>
            </IconButton>
          </TopBarRight>
        </TopBarContainer>

        {/* Canvas Area */}
        <CanvasArea>
          {/* Canvas */}
          <CanvasWrapper>
            <CanvasHeader>
              <CanvasLabel>Waveform</CanvasLabel>
              <CanvasTime>48.0 kHz</CanvasTime>
            </CanvasHeader>
            <CanvasContainer>
              <WaveformCanvas isRunning={isRunning} showGrid={showGrid} waveformColor={traceColor} />
            </CanvasContainer>
          </CanvasWrapper>

          {/* Control Panel */}
          <PanelContainer>
            <PanelTabs>
              <PanelTab backgroundColor={activeTab === "display" ? "$gray3" : "transparent"} onPress={() => setActiveTab("display")}>
                <PanelTabText color={activeTab === "display" ? "$gray12" : "$gray9"}>Display</PanelTabText>
              </PanelTab>
              <PanelTab backgroundColor={activeTab === "trigger" ? "$gray3" : "transparent"} onPress={() => setActiveTab("trigger")}>
                <PanelTabText color={activeTab === "trigger" ? "$gray12" : "$gray9"}>Trigger</PanelTabText>
              </PanelTab>
              <PanelTab backgroundColor={activeTab === "measure" ? "$gray3" : "transparent"} onPress={() => setActiveTab("measure")}>
                <PanelTabText color={activeTab === "measure" ? "$gray12" : "$gray9"}>Meas</PanelTabText>
              </PanelTab>
            </PanelTabs>

            <PanelContent>
              {activeTab === "display" && (
                <>
                  <ButtonGroup>
                    <ActionButton
                      backgroundColor={isRunning ? "$gray4" : "$accent"}
                      hoverStyle={{ backgroundColor: isRunning ? "$gray5" : "$accentHover" }}
                      onPress={() => setIsRunning(!isRunning)}
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
                    <ActionButton backgroundColor="$gray3" borderWidth={1} borderColor="rgba(255, 255, 255, 0.06)" hoverStyle={{ backgroundColor: "$gray4" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="$gray12" strokeWidth="2">
                        <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                      </svg>
                      <ActionButtonText color="$gray12">Freeze</ActionButtonText>
                    </ActionButton>
                  </ButtonGroup>

                  <PanelSection>
                    <SectionTitle>Time Base</SectionTitle>
                    <SliderContainer>
                      <SliderHeader>
                        <SliderLabel>Time/Div</SliderLabel>
                        <SliderValue>{timeDiv.toFixed(1)} ms</SliderValue>
                      </SliderHeader>
                      <Slider value={[timeDiv]} min={0.1} max={10} step={0.1} onValueChange={([v]) => setTimeDiv(v)} width="100%" />
                    </SliderContainer>
                  </PanelSection>

                  <PanelSection>
                    <SectionTitle>Vertical</SectionTitle>
                    <SliderContainer>
                      <SliderHeader>
                        <SliderLabel>Volt/Div</SliderLabel>
                        <SliderValue>{voltDiv.toFixed(1)} V</SliderValue>
                      </SliderHeader>
                      <Slider value={[voltDiv]} min={0.1} max={5} step={0.1} onValueChange={([v]) => setVoltDiv(v)} width="100%" />
                    </SliderContainer>
                  </PanelSection>

                  <PanelSection>
                    <SectionTitle>Trace</SectionTitle>
                    <CheckboxRow>
                      <SliderLabel>Color</SliderLabel>
                      <ColorPicker>
                        <ColorSwatch backgroundColor="#14b8a6" borderWidth={traceColor === "teal" ? 2 : 0} borderColor="white" onPress={() => setTraceColor("teal")} />
                        <ColorSwatch backgroundColor="#ef4444" borderWidth={traceColor === "red" ? 2 : 0} borderColor="white" onPress={() => setTraceColor("red")} />
                        <ColorSwatch backgroundColor="#8b5cf6" borderWidth={traceColor === "blue" ? 2 : 0} borderColor="white" onPress={() => setTraceColor("blue")} />
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
                    <ActionButton backgroundColor={edgeMode === "rising" ? "$accent" : "$gray3"} borderWidth={1} borderColor="rgba(255, 255, 255, 0.06)" onPress={() => setEdgeMode("rising")}>
                      <ActionButtonText color={edgeMode === "rising" ? "black" : "$gray12"}>Rising</ActionButtonText>
                    </ActionButton>
                    <ActionButton backgroundColor={edgeMode === "falling" ? "$accent" : "$gray3"} borderWidth={1} borderColor="rgba(255, 255, 255, 0.06)" onPress={() => setEdgeMode("falling")}>
                      <ActionButtonText color={edgeMode === "falling" ? "black" : "$gray12"}>Falling</ActionButtonText>
                    </ActionButton>
                  </ButtonGroup>
                  <SliderContainer>
                    <SliderHeader>
                      <SliderLabel>Level</SliderLabel>
                      <SliderValue>{triggerLevel.toFixed(2)} V</SliderValue>
                    </SliderHeader>
                    <Slider value={[triggerLevel]} min={-2} max={2} step={0.01} onValueChange={([v]) => setTriggerLevel(v)} width="100%" />
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
        </CanvasArea>

        {/* Bottom Bar */}
        <BottomBarContainer>
          <BottomInfo>
            <InfoItem>
              <InfoLabel>Sample Rate:</InfoLabel>
              <InfoValue>48.0 kHz</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Buffer:</InfoLabel>
              <InfoValue>1024</InfoValue>
            </InfoItem>
            <InfoItem>
              <InfoLabel>Time:</InfoLabel>
              <InfoValue>{(timeDiv * 10).toFixed(1)} ms</InfoValue>
            </InfoItem>
          </BottomInfo>

          <ViewToggle>
            <ViewToggleButton backgroundColor={viewMode === "time" ? "$gray3" : "transparent"} onPress={() => setViewMode("time")}>
              <ViewToggleText color={viewMode === "time" ? "$gray12" : "$gray9"}>Time</ViewToggleText>
            </ViewToggleButton>
            <ViewToggleButton backgroundColor={viewMode === "spectrum" ? "$gray3" : "transparent"} onPress={() => setViewMode("spectrum")}>
              <ViewToggleText color={viewMode === "spectrum" ? "$gray12" : "$gray9"}>Spectrum</ViewToggleText>
            </ViewToggleButton>
          </ViewToggle>
        </BottomBarContainer>
      </MainArea>
    </PageContainer>
  );
}

// Waveform Canvas Component
function WaveformCanvas({ isRunning, showGrid, waveformColor }: { isRunning: boolean; showGrid: boolean; waveformColor: string }) {
  const canvasRef = { current: null as HTMLCanvasElement | null };
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  const animationRef = { current: null as number | null };

  const colorMap: Record<string, string> = {
    teal: "#14b8a6",
    red: "#ef4444",
    blue: "#8b5cf6",
  };

  const finalColor = colorMap[waveformColor] || "#14b8a6";

  const canvasCallback = (ref: HTMLCanvasElement | null) => {
    if (ref) {
      setCanvasElement(ref);
    }
  };

  // This is a simplified version - in real implementation, use useRef and useEffect properly
  return (
    <canvas
      ref={canvasCallback}
      style={{ width: "100%", height: "100%", display: "block", backgroundColor: "#000" }}
    />
  );
}
