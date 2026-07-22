import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const SidebarRoot = styled(YStack, {
  width: 240,
  height: "100%",
  backgroundColor: "$gray2",
  borderRightWidth: 1,
  borderRightColor: "$border",
  padding: "$md",
  gap: "$xs",
});

const SidebarItem = styled(YStack, {
  paddingVertical: "$sm",
  paddingHorizontal: "$md",
  borderRadius: "$md",
  cursor: "pointer",
  alignItems: "flex-start",
  gap: "$xs",

  variants: {
    active: {
      true: {
        backgroundColor: "$accent",
      },
    },
  } as const,
});

const SidebarItemText = styled(Text, {
  fontSize: 14,
  color: "$gray12",
});

export interface SidebarItemProperties {
  active?: boolean;
  children?: React.ReactNode;
}

function SidebarItemComponent({ active, children }: SidebarItemProperties): React.ReactElement {
  return <SidebarItem active={active}>{children}</SidebarItem>;
}

SidebarItemComponent.displayName = "SidebarItem";

export interface SidebarProperties {
  children?: React.ReactNode;
}

function Sidebar({ children }: SidebarProperties): React.ReactElement {
  return <SidebarRoot>{children}</SidebarRoot>;
}

Sidebar.displayName = "Sidebar";

export { Sidebar, SidebarRoot, SidebarItemComponent, SidebarItem, SidebarItemText };
