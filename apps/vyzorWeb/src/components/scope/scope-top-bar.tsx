/**
 * ScopeTopBar - Top navigation bar with hamburger menu
 */

import { useState } from "react";
import { styled, XStack, YStack, Text, Stack } from "tamagui";

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
  shadowColor: "#22c55e",
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.5,
  shadowRadius: 4,
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

/* Dropdown Menu */
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
  display: "none",
});

const DropdownMenuVisible = styled(YStack, {
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

interface ScopeTopBarProperties {
  scopeName?: string;
  isLive?: boolean;
}

export function ScopeTopBar({ scopeName = "Scope 1", isLive = false }: ScopeTopBarProperties): React.ReactElement {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
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
          <DropdownMenuVisible>
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
          </DropdownMenuVisible>
        )}

        <ScopeTitle>{scopeName}</ScopeTitle>
        
        <StatusBadge>
          {isLive ? <StatusDotLive /> : <StatusDot />}
          <StatusText>{isLive ? "Live" : "Stopped"}</StatusText>
        </StatusBadge>
      </TopBarLeft>

      <TopBarRight>
        <IconButton
          backgroundColor="transparent"
          hoverStyle={{ backgroundColor: "$gray3" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray10" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </IconButton>
        <IconButton
          backgroundColor="transparent"
          hoverStyle={{ backgroundColor: "$gray3" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="$gray10" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4m4-5 5 5 5-5m-5 5V3" />
          </svg>
        </IconButton>
      </TopBarRight>
    </TopBarContainer>
  );
}
