import * as React from "react";
import { RadioGroup as TamaguiRadioGroup, YStack, Text, styled } from "tamagui";

const RadioGroupRoot = TamaguiRadioGroup;

const RadioGroupItem = styled(TamaguiRadioGroup.Item, {
  width: 20,
  height: 20,
  borderRadius: "$full",
  borderWidth: 2,
  borderColor: "$gray8",
  cursor: "pointer",
  justifyContent: "center",
  alignItems: "center",
});

const RadioGroupIndicator = styled(YStack, {
  width: 10,
  height: 10,
  borderRadius: "$full",
  backgroundColor: "$neutral",
});

export {
  RadioGroupRoot as RadioGroup,
  RadioGroupItem,
  RadioGroupIndicator,
};

