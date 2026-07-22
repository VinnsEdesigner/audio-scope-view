import * as React from "react";
import { YStack, Input, Text, ScrollView, styled } from "tamagui";

const CommandRoot = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  borderWidth: 1,
  borderColor: "$border",
  overflow: "hidden",
});

const CommandInput = styled(Input, {
  borderWidth: 0,
  borderBottomWidth: 1,
  borderColor: "$border",
  borderRadius: 0,
});

const CommandList = styled(ScrollView, {
  maxHeight: 300,
  padding: 8,
});

const CommandEmpty = styled(Text, {
  paddingVertical: 16,
  textAlign: "center",
  fontSize: 14,
  color: "$gray9",
});

const CommandGroup = styled(YStack, {
  gap: 4,
  padding: 8,
});

const CommandItem = styled(YStack, {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  padding: 10,
  borderRadius: "$sm",
  cursor: "pointer",
});

const CommandSeparator = styled(YStack, {
  height: 1,
  backgroundColor: "$border",
  marginVertical: 4,
});

export {
  CommandRoot as Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
};

