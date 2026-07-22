/**
 * AppSidebar - Primary vertical navigation for the app shell.
 * Neutral (gray) tokens only; active row uses a subtle gray fill.
 */

import * as React from "react";
import { NavLink } from "react-router-dom";
import { styled, YStack, XStack, Text } from "tamagui";
import { LayoutDashboard, Activity, KeyRound, Settings as SettingsIcon } from "lucide-react";

const SidebarRoot = styled(YStack, {
  height: "100%",
  backgroundColor: "$gray2",
  borderRightWidth: 1,
  borderRightColor: "$gray5",
  paddingVertical: "$md",
  paddingHorizontal: "$sm",
  gap: "$xs",

  variants: {
    collapsed: {
      true: { width: 64 },
      false: { width: 232 },
    },
  } as const,
});

const Brand = styled(XStack, {
  alignItems: "center",
  gap: "$sm",
  paddingHorizontal: "$sm",
  paddingVertical: "$sm",
  marginBottom: "$sm",
});

const BrandDot = styled(YStack, {
  width: 22,
  height: 22,
  borderRadius: "$md",
  backgroundColor: "$gray12",
});

const BrandText = styled(Text, {
  fontSize: 15,
  fontWeight: "700",
  color: "$gray12",
  letterSpacing: -0.2,
});

const SectionLabel = styled(Text, {
  fontSize: 11,
  fontWeight: "600",
  color: "$gray9",
  textTransform: "uppercase",
  letterSpacing: 0.6,
  paddingHorizontal: "$sm",
  paddingTop: "$md",
  paddingBottom: "$xs",
});

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/scope", label: "Scopes", icon: Activity, end: false },
  { to: "/api-keys", label: "API Keys", icon: KeyRound, end: false },
  { to: "/settings", label: "Settings", icon: SettingsIcon, end: false },
] as const;

export interface AppSidebarProperties {
  collapsed?: boolean;
}

export function AppSidebar({ collapsed = false }: AppSidebarProperties): React.ReactElement {
  return (
    <SidebarRoot collapsed={collapsed}>
      <Brand>
        <BrandDot />
        {!collapsed && <BrandText>Vyzor</BrandText>}
      </Brand>

      {!collapsed && <SectionLabel>Workspace</SectionLabel>}

      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          style={{ textDecoration: "none" }}
          className="app-nav-link"
        >
          {({ isActive }) => (
            <XStack
              alignItems="center"
              gap="$sm"
              paddingHorizontal="$sm"
              paddingVertical="$sm"
              borderRadius="$md"
              backgroundColor={isActive ? "$gray4" : "transparent"}
              hoverStyle={{ backgroundColor: isActive ? "$gray4" : "$gray3" }}
              cursor="pointer"
            >
              <Icon size={18} color={isActive ? "var(--color-gray12)" : "var(--color-gray11)"} />
              {!collapsed && (
                <Text
                  fontSize={14}
                  fontWeight={isActive ? "600" : "500"}
                  color={isActive ? "$gray12" : "$gray11"}
                >
                  {label}
                </Text>
              )}
            </XStack>
          )}
        </NavLink>
      ))}
    </SidebarRoot>
  );
}

AppSidebar.displayName = "AppSidebar";