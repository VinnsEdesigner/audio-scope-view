import { YStack, Text, styled } from "tamagui";

const ToasterRoot = styled(YStack, {
  backgroundColor: "$gray12",
  borderRadius: "$md",
  padding: "$md",
  gap: 8,
});

const ToasterToast = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  padding: "$md",
  borderWidth: 1,
  borderColor: "$border",
  shadowRadius: 4,
  shadowColor: "black",
  shadowOpacity: 0.1,
});

const ToasterDescription = styled(Text, {
  fontSize: 14,
  color: "$gray11",
});

const ToasterTitle = styled(Text, {
  fontSize: 14,
  fontWeight: "600",
  color: "$gray12",
});

export { ToasterRoot as Toaster, ToasterToast, ToasterDescription, ToasterTitle };
