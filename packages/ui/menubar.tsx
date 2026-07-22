import * as React from "react";
import { YStack, styled } from "tamagui";

const MenubarRoot = styled(YStack, {
  flexDirection: "row",
  backgroundColor: "$gray2",
  borderRadius: "$md",
  padding: 4,
  gap: 4,
});

const MenubarItem = styled(YStack, {
  paddingVertical: 8,
  paddingHorizontal: 12,
  cursor: "pointer",
  borderRadius: "$sm",
});

const MenubarSeparator = styled(YStack, {
  width: 1,
  backgroundColor: "$border",
  marginVertical: 4,
});

export { MenubarRoot as Menubar, MenubarItem, MenubarSeparator };
