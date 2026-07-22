import * as React from "react";
import { YStack, XStack, Text, styled } from "tamagui";

const SidebarRoot = styled(YStack, {
  width: 250,
  backgroundColor: "$gray2",
  borderRightWidth: 1,
  borderRightColor: "$border",
  height: "100%",
});

const SidebarHeader = styled(YStack, {
  padding: "$md",
  borderBottomWidth: 1,
  borderBottomColor: "$border",
});

const SidebarContent = styled(YStack, {
  flex: 1,
  padding: "$md",
});

const SidebarFooter = styled(YStack, {
  padding: "$md",
  borderTopWidth: 1,
  borderTopColor: "$border",
});

const SidebarItem = styled(XStack, {
  paddingVertical: 10,
  paddingHorizontal: 12,
  cursor: "pointer",
  borderRadius: "$md",
  gap: 8,
});

const SidebarGroup = styled(YStack, {
  gap: 4,
});

const SidebarGroupLabel = styled(Text, {
  fontSize: 12,
  fontWeight: "600",
  color: "$gray10",
  paddingVertical: 8,
  paddingHorizontal: 12,
});

export {
  SidebarRoot as Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarItem,
  SidebarGroup,
  SidebarGroupLabel,
};
