/**
 * ScopeSidebar - Left navigation sidebar
 * Contains icons for switching between views
 */

import { styled, YStack, Stack } from "tamagui";

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
  transition: "all 0.15s ease",
});

const SidebarDivider = styled(Stack, {
  height: 1,
  backgroundColor: "rgba(255, 255, 255, 0.06)",
  marginHorizontal: 12,
  marginVertical: 8,
});

interface SidebarButtonProperties {
  icon: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  title: string;
}

function SidebarIconButton({ icon, isActive, onClick, title }: SidebarButtonProperties): React.ReactElement {
  return (
    <SidebarButton
      backgroundColor={isActive ? "$accent" : "transparent"}
      hoverStyle={{
        backgroundColor: isActive ? "$accentHover" : "$gray3",
      }}
      onPress={onClick}
      aria-label={title}
      title={title}
    >
      {icon}
    </SidebarButton>
  );
}

interface ScopeSidebarProperties {
  activeView: string;
  onViewChange: (view: "scope" | "spectrum" | "measure") => void;
}

export function ScopeSidebar({ activeView, onViewChange }: ScopeSidebarProperties): React.ReactElement {
  return (
    <SidebarContainer>
      {/* Scope View */}
      <SidebarIconButton
        title="Scope"
        isActive={activeView === "scope"}
        onClick={() => onViewChange("scope")}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeView === "scope" ? "black" : "$gray11"} strokeWidth="2">
            <circle cx="12" cy="12" r="2" />
            <path d="M16.24 7.76a6 6 0 010 8.49m-8.48-.01a6 6 0 010-8.49m11.31-2.82a10 10 0 010 14.14m-14.14 0a10 10 0 010-14.14" />
          </svg>
        }
      />

      {/* Spectrum View */}
      <SidebarIconButton
        title="Spectrum"
        isActive={activeView === "spectrum"}
        onClick={() => onViewChange("spectrum")}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeView === "spectrum" ? "black" : "$gray11"} strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        }
      />

      {/* Measure View */}
      <SidebarIconButton
        title="Measure"
        isActive={activeView === "measure"}
        onClick={() => onViewChange("measure")}
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeView === "measure" ? "black" : "$gray11"} strokeWidth="2">
            <path d="M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z" />
          </svg>
        }
      />

      <SidebarDivider />

      {/* Capture */}
      <SidebarIconButton
        title="Capture"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        }
      />

      {/* Info */}
      <SidebarIconButton
        title="Info"
        icon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="$gray11" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4m0-4h.01" />
          </svg>
        }
      />
    </SidebarContainer>
  );
}
