import * as React from "react";
import { Input, YStack, styled } from "tamagui";

const InputOTP = styled(YStack, {
  flexDirection: "row",
  gap: 8,
});

const InputOTPGroup = styled(YStack, {
  flexDirection: "row",
});

const InputOTPSlot = styled(YStack, {
  width: 40,
  height: 40,
  borderWidth: 1,
  borderColor: "$border",
  borderRadius: "$md",
  justifyContent: "center",
  alignItems: "center",
});

const InputOTPSeparator = styled(YStack, {
  width: 8,
});

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
