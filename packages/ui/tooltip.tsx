import * as React from "react";
import { Tooltip as TamaguiTooltip, Portal, Text, YStack, styled } from "tamagui";

const TooltipProvider = TamaguiTooltip.Provider;

const TooltipRoot = TamaguiTooltip;

const TooltipTrigger = TamaguiTooltip.Trigger;

const TooltipContent = styled(YStack, {
  backgroundColor: "$gray12",
  borderRadius: "$sm",
  paddingVertical: 6,
  paddingHorizontal: 10,
  zIndex: 100,
});

const TooltipText = styled(Text, {
  fontSize: 12,
  color: "$gray1",
});

export {
  TooltipRoot as Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
};

export { TooltipText };

