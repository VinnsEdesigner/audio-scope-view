import * as React from "react";
import { Accordion as TamaguiAccordion, YStack, Text, XStack, styled } from "tamagui";

const AccordionRoot = TamaguiAccordion;

const AccordionItem = styled(YStack, {
  borderBottomWidth: 1,
  borderBottomColor: "$border",
});

const AccordionTrigger = styled(TamaguiAccordion.Trigger, {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: 16,
  cursor: "pointer",
  width: "100%",
});

const AccordionContent = styled(TamaguiAccordion.Content, {
  overflow: "hidden",
});

export {
  AccordionRoot as Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
};

