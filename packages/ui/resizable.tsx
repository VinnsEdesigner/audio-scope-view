import * as React from "react";
import { YStack, styled } from "tamagui";

const ResizablePanel = styled(YStack, {
  flex: 1,
  minWidth: 100,
});

const ResizableHandle = styled(YStack, {
  cursor: "col-resize",
  width: 4,
  backgroundColor: "$border",
});

export { ResizablePanel, ResizableHandle };
