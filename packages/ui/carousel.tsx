import * as React from "react";
import { ScrollView, YStack, XStack, styled } from "tamagui";

const CarouselRoot = styled(YStack, {
  position: "relative",
  width: "100%",
});

const CarouselContent = styled(ScrollView, {
  flex: 1,
  flexDirection: "row",
  overflow: "scroll",
});

const CarouselItem = styled(YStack, {
  minWidth: "100%",
  flexShrink: 0,
});

const CarouselPrevious = styled(XStack, {
  position: "absolute",
  left: 8,
  top: "50%",
  transform: "translateY(-50%)",
  width: 32,
  height: 32,
  borderRadius: "$full",
  backgroundColor: "$gray1",
  borderWidth: 1,
  borderColor: "$border",
  justifyContent: "center",
  alignItems: "center",
  cursor: "pointer",
});

const CarouselNext = styled(XStack, {
  position: "absolute",
  right: 8,
  top: "50%",
  transform: "translateY(-50%)",
  width: 32,
  height: 32,
  borderRadius: "$full",
  backgroundColor: "$gray1",
  borderWidth: 1,
  borderColor: "$border",
  justifyContent: "center",
  alignItems: "center",
  cursor: "pointer",
});

export {
  CarouselRoot as Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
};

