/**
 * ScopePage - Main oscilloscope page layout
 * Matches the professional oscilloscope UI design
 */

import { useState } from "react";
import { styled, XStack, YStack, Text, Stack, Button } from "tamagui";
import { ScopeSidebar } from "./scope-sidebar";
import { ScopeTopBar } from "./scope-top-bar";
import { ScopeCanvas } from "./scope-canvas";
import { ScopeControlPanel } from "./scope-control-panel";
import { ScopeBottomBar } from "./scope-bottom-bar";

const PageContainer = styled(XStack, {
  flex: 1,
  height: "100vh",
  overflow: "hidden",
  backgroundColor: "$gray1",
});

const MainArea = styled(YStack, {
  flex: 1,
  overflow: "hidden",
});

export function ScopePage(): React.ReactElement {
  const [activeView, setActiveView] = useState<"scope" | "spectrum" | "measure">("scope");

  return (
    <PageContainer>
      <ScopeSidebar activeView={activeView} onViewChange={setActiveView} />
      
      <MainArea>
        <ScopeTopBar />
        
        <XStack flex={1} padding="$md" gap="$md" overflow="hidden">
          <ScopeCanvas />
          <ScopeControlPanel />
        </XStack>
        
        <ScopeBottomBar />
      </MainArea>
    </PageContainer>
  );
}
