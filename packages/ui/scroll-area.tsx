import * as React from "react";
import { ScrollView, YStack, styled } from "tamagui";

const ScrollArea = styled(ScrollView, {
  flex: 1,
  overflow: "scroll",
});

const ScrollBar = styled(YStack, {
  width: 10,
  backgroundColor: "$gray4",
  borderRadius: "$full",
});

export { ScrollArea, ScrollBar };

