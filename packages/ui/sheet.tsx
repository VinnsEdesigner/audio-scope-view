import * as React from "react";
import { Sheet as TamaguiSheet, Portal, YStack, Text, styled } from "tamagui";

const SheetRoot = TamaguiSheet;

const SheetOverlay = styled(YStack, {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  zIndex: 50,
});

const SheetContent = styled(YStack, {
  position: "fixed",
  zIndex: 51,
  backgroundColor: "$gray1",
  padding: "$md",

  variants: {
    side: {
      top: { top: 0, left: 0, right: 0 },
      bottom: { bottom: 0, left: 0, right: 0 },
      left: { top: 0, bottom: 0, left: 0 },
      right: { top: 0, bottom: 0, right: 0 },
    },
  } as const,

  defaultVariants: {
    side: "right",
  },
});

const SheetHeader = styled(YStack, {
  flexDirection: "column",
  gap: 8,
  marginBottom: "$md",
});

const SheetFooter = styled(YStack, {
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: "$sm",
  marginTop: "$md",
});

const SheetTitle = styled(Text, {
  fontSize: 20,
  fontWeight: "600",
  color: "$gray12",
});

const SheetDescription = styled(Text, {
  fontSize: 14,
  color: "$gray9",
});

export {
  SheetRoot as Sheet,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};

