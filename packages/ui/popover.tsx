import * as React from "react";
import { Popover as TamaguiPopover, Portal, YStack, styled } from "tamagui";

const PopoverRoot = TamaguiPopover;

const PopoverTrigger = TamaguiPopover.Trigger;

const PopoverContent = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$border",
  shadowRadius: 8,
  shadowColor: "black",
  shadowOpacity: 0.15,
  shadowOffset: { width: 0, height: 2 },
  zIndex: 50,
  minWidth: 200,
});

export {
  PopoverRoot as Popover,
  PopoverTrigger,
  PopoverContent,
};

