import * as React from "react";
import { AlertDialog as TamaguiAlertDialog, Portal, YStack, XStack, Text, styled } from "tamagui";

const AlertDialogRoot = TamaguiAlertDialog;

const AlertDialogOverlay = styled(YStack, {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  zIndex: 50,
});

const AlertDialogContent = styled(YStack, {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: [["translateX(-50%)"], ["translateY(-50%)"]],
  backgroundColor: "$gray1",
  borderRadius: "$lg",
  padding: "$md",
  minWidth: 400,
  maxWidth: "90vw",
  borderWidth: 1,
  borderColor: "$border",
  zIndex: 51,
});

const AlertDialogHeader = styled(YStack, {
  flexDirection: "column",
  gap: 8,
  marginBottom: "$md",
});

const AlertDialogFooter = styled(XStack, {
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: "$sm",
  marginTop: "$md",
});

const AlertDialogTitle = styled(Text, {
  fontSize: 18,
  fontWeight: "600",
  color: "$gray12",
});

const AlertDialogDescription = styled(Text, {
  fontSize: 14,
  color: "$gray9",
});

export {
  AlertDialogRoot as AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
};

