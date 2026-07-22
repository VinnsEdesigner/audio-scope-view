import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const ContextMenu = YStack;
const ContextMenuTrigger = YStack;
const ContextMenuContent = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  padding: 8,
  borderWidth: 1,
  borderColor: "$border",
  shadowRadius: 8,
  shadowColor: "black",
  shadowOpacity: 0.15,
  minWidth: 200,
  zIndex: 100,
});

const ContextMenuItem = styled(YStack, {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  paddingHorizontal: 12,
  cursor: "pointer",
  borderRadius: "$sm",
});

const ContextMenuCheckboxItem = styled(YStack, {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  paddingHorizontal: 12,
  cursor: "pointer",
  borderRadius: "$sm",
});

const ContextMenuRadioItem = styled(YStack, {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  paddingHorizontal: 12,
  cursor: "pointer",
  borderRadius: "$sm",
});

const ContextMenuLabel = styled(Text, {
  fontSize: 13,
  fontWeight: "600",
  color: "$gray10",
  paddingVertical: 8,
  paddingHorizontal: 12,
});

const ContextMenuSeparator = styled(YStack, {
  height: 1,
  backgroundColor: "$border",
  marginVertical: 4,
});

const ContextMenuShortcut = styled(Text, {
  marginLeft: "auto",
  fontSize: 12,
  color: "$gray9",
});

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
};
