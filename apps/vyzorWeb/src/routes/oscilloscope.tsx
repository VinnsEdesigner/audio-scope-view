/**
 * Oscilloscope - Full oscilloscope page with all controls
 * Professional oscilloscope UI design with hamburger menu navigation
 */

import { useState, useRef, useEffect } from "react";
import { styled, XStack, YStack, Text, Stack } from "tamagui";
import { Slider } from "@audio-scope-view/ui/slider";
import { Switch } from "@audio-scope-view/ui/switch";

const PageContainer = styled(YStack, {
  flex: 1,
  height: "100vh",
  overflow: "hidden",
  backgroundColor: "$gray1",
});

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

const HamburgerButton = styled(Stack, {
  width: 40,
  height: 40,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  position: "relative",
});

const HamburgerMenu = styled(YStack, {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: 8,
  width: 220,
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

const NavItem = styled(XStack, {
  alignItems: "center",
  gap: 12,
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 8,
  cursor: "pointer",
  transition: "all 0.15s ease",
});

const NavItemIcon = styled(Stack, {
  width: 36,
  height: 36,
  borderRadius: 8,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "$gray4",
});

const NavItemText = styled(Text, {
  fontSize: 14,
  fontWeight: "500",
  color: "$gray12",
});

const NavDivider = styled(Stack, {
  height: 1,
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  marginVertical: 8,
  marginHorizontal: 4,
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

export function Oscilloscope(): React.ReactElement {
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
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isMenuOpen]);

  return (
    <PageContainer>
      <TopBarContainer>
        <TopBarLeft>
          <HamburgerButton
            ref={menuRef}
            backgroundColor="transparent"
            hoverStyle={{ backgroundColor: "$gray3" }}
            onPress={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="$gray10" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            
            {isMenuOpen && (
              <HamburgerMenu>
                <NavItem hoverStyle={{ backgroundColor: "$gray4" }} onPress={() => { setIsMenuOpen(false); }}>
                  <NavItemIcon>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray12" strokeWidth="2">
                      <circle cx="12" cy="12" r="2" />
                      <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49" />
                    </svg>
                  </NavItemIcon>
                  <NavItemText>Oscilloscope</NavItemText>
                </NavItem>
                <NavItem hoverStyle={{ backgroundColor: "$gray4" }} onPress={() => { setIsMenuOpen(false); }}>
                  <NavItemIcon>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray12" strokeWidth="2">
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                  </NavItemIcon>
                  <NavItemText>Dashboard</NavItemText>
                </NavItem>
                <NavItem hoverStyle={{ backgroundColor: "$gray4" }} onPress={() => { setIsMenuOpen(false); }}>
                  <NavItemIcon>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray12" strokeWidth="2">
                      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
                    </svg>
                  </NavItemIcon>
                  <NavItemText>Settings</NavItemText>
                </NavItem>
                <NavDivider />
                <NavItem hoverStyle={{ backgroundColor: "$gray4" }} onPress={() => { setIsMenuOpen(false); }}>
                  <NavItemIcon>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray12" strokeWidth="2">
                      <path d="M15 7h3a5 5 0 015 5 5 5 0 01-5 5h-3m-6 0H6a5 5 0 01-5-5 5 5 0 015-5h3" />
                      <path d="M8 12h8" />
                    </svg>
                  </NavItemIcon>
                  <NavItemText>API Keys</NavItemText>
                </NavItem>
              </HamburgerMenu>
            )}
          </HamburgerButton>

          <ScopeTitle>Scope 1</ScopeTitle>
          
          <StatusBadge>
            {isRunning ? <StatusDotLive /> : <StatusDot />}
            <StatusText>{isRunning ? "Live" : "Stopped"}</StatusText>
          </StatusBadge>
        </TopBarLeft>
      </TopBarContainer>

      <CanvasArea>
        <CanvasWrapper>
          <CanvasHeader>
            <CanvasLabel>Waveform</CanvasLabel>
            <CanvasTime>48.0 kHz</CanvasTime>
          </CanvasHeader>
          <CanvasContainer>
            <canvas style={{ width: "100%", height: "100%", display: "block", backgroundColor: "#000" }} />
          </CanvasContainer>
        </CanvasWrapper>

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
    </PageContainer>
  );
}
