import * as React from "react";
import { YStack, Text, styled } from "tamagui";

const FormField = styled(YStack, {
  gap: 4,
});

const FormLabel = styled(Text, {
  fontSize: 14,
  fontWeight: "500",
  color: "$gray12",
});

const FormDescription = styled(Text, {
  fontSize: 13,
  color: "$gray9",
});

const FormMessage = styled(Text, {
  fontSize: 13,
  color: "$gray11",
});

export { FormField, FormLabel, FormDescription, FormMessage };
