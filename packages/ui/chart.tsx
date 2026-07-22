import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const ChartContainer = styled(YStack, {
  aspectRatio: "16/9",
  justifyContent: "center",
});

const ChartTooltipContent = styled(YStack, {
  backgroundColor: "$gray1",
  borderRadius: "$md",
  padding: "$sm",
  borderWidth: 1,
  borderColor: "$border",
  shadowRadius: 4,
  shadowColor: "black",
  shadowOpacity: 0.1,
});

const ChartLegend = styled(YStack, {
  flexDirection: "row",
  justifyContent: "center",
  gap: "$md",
  paddingVertical: "$sm",
});

export {
  ChartContainer,
  ChartTooltipContent,
  ChartLegend,
};
