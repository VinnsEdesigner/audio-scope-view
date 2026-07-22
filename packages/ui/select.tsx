import * as React from "react";
import { Select as TamaguiSelect, YStack, Text, styled } from "tamagui";

const SelectRoot = TamaguiSelect;

const SelectTrigger = styled(TamaguiSelect.Trigger, {
  backgroundColor: "$gray1",
  borderWidth: 1,
  borderColor: "$border",
  borderRadius: "$md",
  height: 40,
  paddingHorizontal: 12,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
});

const SelectContent = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  borderWidth: 1,
  borderColor: "$border",
  padding: 8,
  shadowRadius: 8,
  shadowColor: "black",
  shadowOpacity: 0.15,
  shadowOffset: { width: 0, height: 2 },
  zIndex: 100,
});

const SelectItem = styled(TamaguiSelect.Item, {
  paddingVertical: 10,
  paddingHorizontal: 12,
  cursor: "pointer",
  borderRadius: "$sm",
});

const SelectLabel = styled(Text, {
  fontSize: 13,
  fontWeight: "600",
  paddingVertical: 8,
  paddingHorizontal: 12,
  color: "$gray10",
});

const SelectSeparator = styled(YStack, {
  height: 1,
  backgroundColor: "$border",
  marginVertical: 4,
});

export {
  SelectRoot as Select,
  TamaguiSelect.Group as SelectGroup,
  TamaguiSelect.Value as SelectValue,
  SelectTrigger as SelectTrigger,
  SelectContent as SelectContent,
  SelectLabel as SelectLabel,
  SelectItem as SelectItem,
  SelectSeparator as SelectSeparator,
};

