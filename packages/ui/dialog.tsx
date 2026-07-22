import * as React from "react";
import { Dialog as TamaguiDialog, Portal, YStack, XStack, Text, styled } from "tamagui";

const DialogRoot = TamaguiDialog;

const DialogTrigger = TamaguiDialog.Trigger;

const DialogContent = styled(YStack, {
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
  shadowRadius: 16,
  shadowColor: "black",
  shadowOpacity: 0.2,
  shadowOffset: { width: 0, height: 4 },
  zIndex: 51,
});

const DialogOverlay = styled(YStack, {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  zIndex: 50,
});

const DialogHeader = styled(YStack, {
  flexDirection: "column",
  gap: 6,
  marginBottom: "$md",
});

const DialogFooter = styled(XStack, {
  flexDirection: "row",
  justifyContent: "flex-end",
  gap: "$sm",
  marginTop: "$md",
});

const DialogTitle = styled(Text, {
  fontSize: 20,
  fontWeight: "600",
  color: "$gray12",
});

const DialogDescription = styled(Text, {
  fontSize: 14,
  color: "$gray9",
});

export interface DialogProps extends React.ComponentProps<typeof TamaguiDialog> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Dialog = DialogRoot;
Dialog.displayName = "Dialog";

const DialogClose = TamaguiDialog.Close;

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogOverlay,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
};

