import * as React from "react";
import { YStack, styled } from "tamagui";

const NavigationMenuRoot = styled(YStack, {
  flexDirection: "row",
  alignItems: "center",
  gap: 4,
});

const NavigationMenuItem = styled(YStack, {
  cursor: "pointer",
  paddingVertical: 8,
  paddingHorizontal: 12,
});

const NavigationMenuContent = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$border",
});

const NavigationMenuLink = styled(YStack, {
  cursor: "pointer",
  paddingVertical: 8,
  paddingHorizontal: 12,
});

const NavigationMenuTrigger = styled(YStack, {
  cursor: "pointer",
  paddingVertical: 8,
  paddingHorizontal: 12,
});

export {
  NavigationMenuRoot as NavigationMenu,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuTrigger,
};
